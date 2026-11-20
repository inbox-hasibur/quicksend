"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SignalingClient } from "@/lib/signalingClient";
import { generateRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import {
  createFileHeader,
  createTextHeader,
  DEFAULT_CHUNK_SIZE,
  computeSha256,
  MAX_CHECKSUM_FILE_SIZE,
} from "@/lib/chunker";
import {
  createDiskStreamWriter,
  DISK_STREAM_THRESHOLD,
  isFileSystemAccessSupported,
  type DiskStreamWriter,
} from "@/lib/diskStream";
import { getRtcConfig, fetchIceConfig } from "@/lib/iceConfig";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import type { PeerRole, SignalMessage } from "@/types/signaling";
import type { TransferMode } from "@/types/mode";
import type { TransferProgressState, TransferPayloadHeader } from "@/types/transfer";
import {
  BUFFER_THRESHOLD,
  FIREWALL_BLOCKED_MESSAGE,
  ROOM_NOT_FOUND_MESSAGE,
  waitForDrain,
  waitForChannelOpen,
  normalizeChunkBuffer,
  streamBlobChunks,
  finalizeReceivedPayload,
  appendDebugLog,
  inspectSelectedCandidatePair,
  setupRtcPeerConnectionListeners,
  loadPeerConstructor,
  wirePeerConnectionEvents,
  createPeerJsSender,
  createPeerJsReceiver,
  getInitialDiagnostics,
  type ActiveTransport,
  type CandidateCounts,
  type SelectedCandidatePair,
  type WebRTCDiagnostics,
  type DebugLogEntry,
  type DrainableChannel,
  type PeerJsConnection,
  type PeerJsInstance,
} from "@/lib/webrtc";

// Re-export shared interfaces and constants to maintain 100% backward compatibility
export type {
  CandidateCounts,
  SelectedCandidatePair,
  WebRTCDiagnostics,
  DebugLogEntry,
  DrainableChannel,
};
export {
  BUFFER_THRESHOLD,
  FIREWALL_BLOCKED_MESSAGE,
  ROOM_NOT_FOUND_MESSAGE,
  waitForDrain,
};

export function useWebRTC(mode: TransferMode = "internet") {
  const [role, setRole] = useState<PeerRole | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingHeader, setPendingHeader] = useState<TransferPayloadHeader | null>(null);
  const [brokerNotice, setBrokerNotice] = useState<string | null>(null);

  const [progress, setProgress] = useState<TransferProgressState>({
    status: "idle",
    itemType: "file",
    bytesTransferred: 0,
    totalBytes: 0,
    progressPercentage: 0,
    speedBps: 0,
  });

  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<WebRTCDiagnostics>(getInitialDiagnostics());

  const connectStartTimeRef = useRef<number>(0);
  const hasCheckedStatsRef = useRef<boolean>(false);

  const addLog = useCallback((msg: string) => {
    setDebugLog((prev) => appendDebugLog(prev, msg, connectStartTimeRef.current));
  }, []);

  const checkSelectedPair = useCallback(
    async (pc: RTCPeerConnection) => {
      if (hasCheckedStatsRef.current) return;
      hasCheckedStatsRef.current = true;
      const pair = await inspectSelectedCandidatePair(pc);
      if (pair) {
        setDiagnostics((d) => ({ ...d, selectedPair: pair }));
        addLog(`Selected pair: local ${pair.local}, remote ${pair.remote}`);
      }
    },
    [addLog]
  );

  const activeTransportRef = useRef<ActiveTransport>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const rtcConfigRef = useRef<RTCConfiguration | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const signalingRef = useRef<SignalingClient>(new SignalingClient());
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const currentHeaderRef = useRef<TransferPayloadHeader | null>(null);
  const startTimeRef = useRef<number>(0);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const isConnectedRef = useRef<boolean>(false);
  const hasCreatedOfferRef = useRef<boolean>(false);

  // Batch queue & disk streaming refs
  const diskWriterRef = useRef<DiskStreamWriter | null>(null);
  const peerInstanceRef = useRef<PeerJsInstance | null>(null);
  const peerReceiverCleanupRef = useRef<(() => void) | null>(null);
  const dataConnRef = useRef<PeerJsConnection | null>(null);
  const hasReceiverAcceptedBatchRef = useRef<string | null>(null);
  const hasAcceptedRef = useRef<boolean>(false);
  const acceptedResolverRef = useRef<(() => void) | null>(null);
  const receivedChunkCountRef = useRef<number>(0);
  const activeDownloadUrlsRef = useRef<string[]>([]);
  const isCleaningUpRef = useRef<boolean>(false);
  const sessionGenRef = useRef<number>(0);
  const hasRestartedIceRef = useRef<boolean>(false);
  const receiverSignalingWatchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const receiverDialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasSignalingActivityRef = useRef<boolean>(false);
  const roomNotFoundRef = useRef<boolean>(false);

  const iceRestartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iceWatchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearHandshakeWatchdog = useCallback(() => {
    if (iceRestartTimerRef.current) {
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
    }
    if (iceWatchdogTimerRef.current) {
      clearTimeout(iceWatchdogTimerRef.current);
      iceWatchdogTimerRef.current = null;
    }
  }, []);

  const clearReceiverWatchdogs = useCallback(() => {
    if (receiverSignalingWatchdogTimerRef.current) {
      clearTimeout(receiverSignalingWatchdogTimerRef.current);
      receiverSignalingWatchdogTimerRef.current = null;
    }
    if (receiverDialTimeoutRef.current) {
      clearTimeout(receiverDialTimeoutRef.current);
      receiverDialTimeoutRef.current = null;
    }
  }, []);

  const startHandshakeWatchdog = useCallback(
    (currentRole: PeerRole) => {
      if (isConnectedRef.current || activeTransportRef.current === "peerjs") {
        return;
      }
      if (iceWatchdogTimerRef.current) {
        return;
      }

      addLog("Handshake initiated: starting 15s ICE watchdog (restartIce at 7s)");

      iceRestartTimerRef.current = setTimeout(() => {
        if (
          isCleaningUpRef.current ||
          isConnectedRef.current ||
          activeTransportRef.current === "peerjs"
        ) {
          return;
        }
        const pc = pcRef.current;
        if (pc && !hasRestartedIceRef.current && typeof pc.restartIce === "function") {
          hasRestartedIceRef.current = true;
          addLog("ICE negotiation taking >7s, attempting pc.restartIce()...");
          try {
            pc.restartIce();
            if (currentRole === "sender") {
              pc.createOffer({ iceRestart: true })
                .then((offer) => pc.setLocalDescription(offer).then(() => offer))
                .then((offer) => signalingRef.current.sendSignal("offer", offer))
                .catch((err) => addLog(`ICE restart offer failed: ${err}`));
            }
          } catch (err) {
            addLog(`pc.restartIce() call failed: ${err}`);
          }
        }
      }, 7000);

      iceWatchdogTimerRef.current = setTimeout(() => {
        if (
          isCleaningUpRef.current ||
          isConnectedRef.current ||
          activeTransportRef.current === "peerjs"
        ) {
          return;
        }

        addLog("ICE connection failed after 15s watchdog: 4G/firewall block");
        clearHandshakeWatchdog();
        isConnectedRef.current = false;
        setIsConnected(false);
        setDiagnostics((d) => ({
          ...d,
          iceState: "failed",
          lastError: FIREWALL_BLOCKED_MESSAGE,
        }));
        setProgress((prev) => {
          if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) {
            return prev;
          }
          return { ...prev, status: "error", errorMessage: FIREWALL_BLOCKED_MESSAGE };
        });
      }, 15000);
    },
    [addLog, clearHandshakeWatchdog]
  );

  const wirePeerJs = useCallback(
    (conn: PeerJsConnection, currentRole: PeerRole) => {
      wirePeerConnectionEvents(conn.peerConnection, currentRole, {
        addLog,
        onIceStateChange: (state) => setDiagnostics((d) => ({ ...d, iceState: state })),
        onCandidate: (type) => {
          hasSignalingActivityRef.current = true;
          setDiagnostics((d) => ({
            ...d,
            candidateCounts: {
              ...d.candidateCounts,
              [type]: (d.candidateCounts[type] || 0) + 1,
            },
          }));
        },
        startHandshakeWatchdog: () => startHandshakeWatchdog(currentRole),
        clearHandshakeWatchdog,
        clearReceiverWatchdogs,
        onFirewallBlocked: (errMsg) => {
          setDiagnostics((d) => ({ ...d, iceState: "failed", lastError: errMsg }));
          setProgress((prev) => {
            if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) {
              return prev;
            }
            return { ...prev, status: "error", errorMessage: errMsg };
          });
        },
      });
    },
    [addLog, clearHandshakeWatchdog, clearReceiverWatchdogs, startHandshakeWatchdog]
  );

  const getActiveChannel = useCallback((): DrainableChannel | null => {
    if (dcRef.current) return dcRef.current;
    if (dataConnRef.current && dataConnRef.current.dataChannel) {
      return dataConnRef.current.dataChannel;
    }
    return null;
  }, []);

  const sendRawData = useCallback((data: string | ArrayBuffer) => {
    if (activeTransportRef.current === "peerjs" && dataConnRef.current) {
      try {
        dataConnRef.current.send(data);
        return;
      } catch {
        // Fallback to DataChannel
      }
    }
    if (dcRef.current && dcRef.current.readyState === "open") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dcRef.current.send(data as any);
        return;
      } catch {
        // Channel closing
      }
    }
    if (dataConnRef.current) {
      try {
        dataConnRef.current.send(data);
      } catch {
        // Channel closed
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    sessionGenRef.current++;
    isCleaningUpRef.current = true;
    hasRestartedIceRef.current = false;
    hasSignalingActivityRef.current = false;
    roomNotFoundRef.current = false;
    clearHandshakeWatchdog();
    clearReceiverWatchdogs();
    setBrokerNotice(null);
    activeTransportRef.current = null;
    isConnectedRef.current = false;
    hasAcceptedRef.current = false;
    hasReceiverAcceptedBatchRef.current = null;

    if (acceptedResolverRef.current) {
      try {
        acceptedResolverRef.current();
      } catch {
        // Ignore
      }
      acceptedResolverRef.current = null;
    }
    if (diskWriterRef.current) {
      diskWriterRef.current.abort().catch(() => {});
      diskWriterRef.current = null;
    }
    for (const url of activeDownloadUrlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }
    activeDownloadUrlsRef.current = [];

    if (dataConnRef.current) {
      const conn = dataConnRef.current;
      dataConnRef.current = null;
      try {
        conn.close();
      } catch {
        // Ignore
      }
    }
    if (peerReceiverCleanupRef.current) {
      peerReceiverCleanupRef.current();
      peerReceiverCleanupRef.current = null;
    }
    if (peerInstanceRef.current) {
      const peer = peerInstanceRef.current;
      peerInstanceRef.current = null;
      try {
        peer.destroy();
      } catch {
        // Ignore
      }
    }

    signalingRef.current.leaveRoom();
    if (dcRef.current) {
      const dc = dcRef.current;
      dcRef.current = null;
      dc.onopen = null;
      dc.onclose = null;
      dc.onerror = null;
      dc.onmessage = null;
      try {
        dc.close();
      } catch {
        // Ignore
      }
    }
    if (pcRef.current) {
      const pc = pcRef.current;
      pcRef.current = null;
      pc.onicecandidate = null;
      pc.oniceconnectionstatechange = null;
      pc.onicegatheringstatechange = null;
      pc.onsignalingstatechange = null;
      pc.onconnectionstatechange = null;
      pc.ondatachannel = null;
      try {
        pc.close();
      } catch {
        // Ignore
      }
    }
    receivedChunksRef.current = [];
    receivedChunkCountRef.current = 0;
    currentHeaderRef.current = null;
    candidateQueueRef.current = [];
    hasCreatedOfferRef.current = false;
    setIsConnected(false);
    setPendingHeader(null);
    setRole(null);
    setRoomId(null);
    setRoomCode(null);
    setProgress({
      status: "idle",
      itemType: "file",
      bytesTransferred: 0,
      totalBytes: 0,
      progressPercentage: 0,
      speedBps: 0,
    });
    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 50);
  }, [clearReceiverWatchdogs, clearHandshakeWatchdog]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const handleIncomingData = useCallback(
    async (data: unknown) => {
      if (typeof data === "string") {
        try {
          const msg = JSON.parse(data);
          if (msg.type === "header") {
            const header: TransferPayloadHeader = msg.header;
            currentHeaderRef.current = header;
            setPendingHeader(header);
            receivedChunksRef.current = [];
            receivedChunkCountRef.current = 0;
            startTimeRef.current = Date.now();

            const totalBytes =
              header.type === "file" ? header.file?.size || 0 : header.text?.length || 0;

            const isAutoAcceptedBatch = Boolean(
              header.batchId &&
                hasReceiverAcceptedBatchRef.current === header.batchId &&
                header.fileIndex &&
                header.fileIndex > 1
            );

            setProgress({
              status: isAutoAcceptedBatch ? "transferring" : "waiting-acceptance",
              itemType: header.type,
              fileName: header.file?.name,
              fileSize: header.file?.size,
              textPreview: header.text?.preview,
              bytesTransferred: 0,
              totalBytes,
              progressPercentage: 0,
              speedBps: 0,
              batchId: header.batchId,
              fileIndex: header.fileIndex,
              totalFiles: header.totalFiles,
              totalBatchBytes: header.totalBatchBytes,
              sha256: header.sha256,
              isVerified: false,
            });
          } else if (msg.type === "transfer-accepted") {
            hasAcceptedRef.current = true;
            if (acceptedResolverRef.current) {
              acceptedResolverRef.current();
              acceptedResolverRef.current = null;
            }
          } else if (msg.type === "transfer-rejected") {
            hasAcceptedRef.current = false;
            if (acceptedResolverRef.current) {
              acceptedResolverRef.current = null;
            }
            setProgress((prev) => ({
              ...prev,
              status: "rejected",
              errorMessage: "Receiver declined the incoming transfer.",
            }));
          }
        } catch {
          // Ignore non-json
        }
        return;
      }

      const buffer = await normalizeChunkBuffer(data);
      if (buffer) {
        const header = currentHeaderRef.current;
        if (!header) return;

        receivedChunkCountRef.current++;

        if (diskWriterRef.current) {
          await diskWriterRef.current.writeChunk(buffer);
        } else {
          receivedChunksRef.current.push(buffer);
        }

        const totalBytes =
          header.type === "file" ? header.file?.size || 0 : header.text?.length || 0;

        const currentBytes = diskWriterRef.current
          ? Math.min(totalBytes, receivedChunkCountRef.current * (header.chunkSize || DEFAULT_CHUNK_SIZE))
          : receivedChunksRef.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);

        const progressPercent = Math.min(100, Math.round((currentBytes / (totalBytes || 1)) * 100));
        const elapsedSec = (Date.now() - startTimeRef.current) / 1000 || 0.1;
        const speed = Math.round(currentBytes / elapsedSec);

        setProgress((prev) => ({
          ...prev,
          status: "transferring",
          bytesTransferred: currentBytes,
          progressPercentage: progressPercent,
          speedBps: speed,
        }));

        if (receivedChunkCountRef.current >= header.totalChunks) {
          const { fullText, downloadUrl, isVerified } = await finalizeReceivedPayload({
            header,
            receivedChunks: receivedChunksRef.current,
            diskWriter: diskWriterRef.current,
            mode,
          });

          if (diskWriterRef.current) {
            diskWriterRef.current = null;
          }
          if (downloadUrl) {
            activeDownloadUrlsRef.current.push(downloadUrl);
          }

          const isLastInBatch =
            !header.totalFiles || !header.fileIndex || header.fileIndex >= header.totalFiles;

          setProgress((prev) => ({
            ...prev,
            status: isLastInBatch ? "completed" : "transferring",
            textContent: fullText,
            downloadUrl,
            progressPercentage: 100,
            speedBps: 0,
            isVerified,
          }));
        }
      }
    },
    [mode]
  );

  const setupDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dc.binaryType = "arraybuffer";

      dc.onopen = () => {
        addLog("DataChannel open");
        setDiagnostics((d) => ({ ...d, channelState: "open" }));
        clearHandshakeWatchdog();
        clearReceiverWatchdogs();
        if (activeTransportRef.current === "peerjs" && isConnectedRef.current) {
          return;
        }
        activeTransportRef.current = "webrtc";
        isConnectedRef.current = true;
        setIsConnected(true);
        if (dataConnRef.current && !dataConnRef.current.open) {
          try {
            dataConnRef.current.close();
          } catch {
            // Ignore
          }
        }
      };

      dc.onclose = () => {
        addLog("DataChannel close");
        setDiagnostics((d) => ({ ...d, channelState: "closed" }));
        if (isCleaningUpRef.current) return;
        if (activeTransportRef.current === "webrtc") {
          isConnectedRef.current = false;
          setIsConnected(false);
        }
      };

      dc.onerror = () => {
        addLog("DataChannel error");
        setDiagnostics((d) => ({
          ...d,
          channelState: "closing",
          lastError: "DataChannel error occurred during transfer.",
        }));
        if (isCleaningUpRef.current || !dcRef.current) return;
        if (activeTransportRef.current === "peerjs") return;
        setProgress((prev) => {
          if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) {
            return prev;
          }
          return {
            ...prev,
            status: "error",
            errorMessage: "DataChannel error occurred during transfer.",
          };
        });
      };

      dc.onmessage = (event) => {
        handleIncomingData(event.data);
      };
    },
    [clearReceiverWatchdogs, clearHandshakeWatchdog, handleIncomingData, addLog]
  );

  const createPeerConnection = useCallback(
    (currentRole: PeerRole, customConfig?: RTCConfiguration) => {
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          // Ignore
        }
      }

      const config = customConfig || rtcConfigRef.current || getRtcConfig(mode);
      const pc = new RTCPeerConnection(config);
      pcRef.current = pc;

      setupRtcPeerConnectionListeners(pc, {
        currentRole,
        addLog,
        onCandidate: (type, cand) => {
          setDiagnostics((d) => ({
            ...d,
            candidateCounts: {
              ...d.candidateCounts,
              [type]: d.candidateCounts[type] + 1,
            },
          }));
          signalingRef.current.sendSignal("candidate", cand.toJSON()).catch(() => {});
        },
        onIceChecking: () => {
          hasSignalingActivityRef.current = true;
          startHandshakeWatchdog(currentRole);
        },
        onIceConnected: () => {
          clearHandshakeWatchdog();
          clearReceiverWatchdogs();
          checkSelectedPair(pc);
        },
        onIceFailed: () => {
          if (activeTransportRef.current === "peerjs" || isConnectedRef.current || (dataConnRef.current && dataConnRef.current.open)) {
            addLog("Raw WebRTC ICE failed, but PeerJS transport is active/connected");
            return;
          }
          if (!hasRestartedIceRef.current && typeof pc.restartIce === "function") {
            hasRestartedIceRef.current = true;
            addLog("ICE state failed, attempting restartIce()...");
            try {
              pc.restartIce();
              if (currentRole === "sender") {
                pc.createOffer({ iceRestart: true })
                  .then((offer) => pc.setLocalDescription(offer).then(() => offer))
                  .then((offer) => signalingRef.current.sendSignal("offer", offer))
                  .catch((err) => addLog(`ICE restart offer failed: ${err}`));
              }
              return;
            } catch (err) {
              addLog(`pc.restartIce() call failed: ${err}`);
            }
          }
          setDiagnostics((d) => ({ ...d, lastError: FIREWALL_BLOCKED_MESSAGE }));
          clearHandshakeWatchdog();
          isConnectedRef.current = false;
          setIsConnected(false);
          setProgress((prev) => {
            if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) return prev;
            return { ...prev, status: "error", errorMessage: FIREWALL_BLOCKED_MESSAGE };
          });
        },
        onIceStateChange: (state) => setDiagnostics((d) => ({ ...d, iceState: state })),
        onGatheringStateChange: (state) => setDiagnostics((d) => ({ ...d, gatheringState: state })),
        onSignalingStateChange: (state) => setDiagnostics((d) => ({ ...d, signalingState: state })),
        onConnectionConnected: () => {
          clearHandshakeWatchdog();
          if (activeTransportRef.current === "peerjs" && isConnectedRef.current) return;
          activeTransportRef.current = "webrtc";
          isConnectedRef.current = true;
          setIsConnected(true);
        },
        onConnectionFailed: () => {
          if (activeTransportRef.current === "peerjs" || (dataConnRef.current && dataConnRef.current.open)) return;
          isConnectedRef.current = false;
          setIsConnected(false);
          clearHandshakeWatchdog();
          setProgress((prev) => {
            if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) return prev;
            return { ...prev, status: "error", errorMessage: FIREWALL_BLOCKED_MESSAGE };
          });
          setDiagnostics((d) => ({ ...d, lastError: FIREWALL_BLOCKED_MESSAGE }));
        },
        onConnectionDisconnected: () => {
          if (activeTransportRef.current === "peerjs") return;
          isConnectedRef.current = false;
          setIsConnected(false);
        },
        onDataChannel: (dc) => {
          if (activeTransportRef.current === "peerjs" && isConnectedRef.current) return;
          dcRef.current = dc;
          activeTransportRef.current = "webrtc";
          setupDataChannel(dc);
        },
      });

      return pc;
    },
    [
      mode,
      setupDataChannel,
      clearReceiverWatchdogs,
      clearHandshakeWatchdog,
      startHandshakeWatchdog,
      addLog,
      checkSelectedPair,
    ]
  );

  const handleSignalMessage = useCallback(
    async (message: SignalMessage, currentRole: PeerRole) => {
      if (activeTransportRef.current === "peerjs" && isConnectedRef.current) return;
      hasSignalingActivityRef.current = true;
      const pc = pcRef.current;

      switch (message.type) {
        case "peer-joined": {
          if (activeTransportRef.current === "peerjs" && isConnectedRef.current) return;
          if (hasCreatedOfferRef.current) return;
          hasCreatedOfferRef.current = true;
          startHandshakeWatchdog(currentRole);
          if (currentRole === "sender" && pc) {
            const dc = pc.createDataChannel("share-channel", { ordered: true });
            dcRef.current = dc;
            setupDataChannel(dc);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            addLog("Offer created");
            setDiagnostics((d) => ({ ...d, signalingState: pc.signalingState }));
            await signalingRef.current.sendSignal("offer", offer);
          }
          break;
        }

        case "offer": {
          if (currentRole === "receiver") {
            startHandshakeWatchdog(currentRole);
            const pcInstance = pc || createPeerConnection("receiver");
            await pcInstance.setRemoteDescription(
              new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
            );
            addLog("Remote description set");
            setDiagnostics((d) => ({ ...d, signalingState: pcInstance.signalingState }));

            while (candidateQueueRef.current.length > 0) {
              const cand = candidateQueueRef.current.shift();
              if (cand) {
                try {
                  await pcInstance.addIceCandidate(new RTCIceCandidate(cand));
                } catch {
                  // Ignore late candidate
                }
              }
            }

            const answer = await pcInstance.createAnswer();
            await pcInstance.setLocalDescription(answer);
            await signalingRef.current.sendSignal("answer", answer);
          }
          break;
        }

        case "answer": {
          if (currentRole === "sender" && pc) {
            startHandshakeWatchdog(currentRole);
            addLog("Answer received");
            await pc.setRemoteDescription(
              new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
            );
            addLog("Remote description set");
            setDiagnostics((d) => ({ ...d, signalingState: pc.signalingState }));

            while (candidateQueueRef.current.length > 0) {
              const cand = candidateQueueRef.current.shift();
              if (cand) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {
                  // Ignore late candidate
                }
              }
            }
          }
          break;
        }

        case "candidate": {
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit));
            } catch {
              // Ignore late candidate
            }
          } else {
            candidateQueueRef.current.push(message.payload as RTCIceCandidateInit);
          }
          break;
        }

        case "transfer-accepted": {
          hasAcceptedRef.current = true;
          if (acceptedResolverRef.current) {
            acceptedResolverRef.current();
            acceptedResolverRef.current = null;
          }
          break;
        }

        case "transfer-rejected": {
          hasAcceptedRef.current = false;
          if (acceptedResolverRef.current) {
            acceptedResolverRef.current = null;
          }
          setProgress((prev) => ({
            ...prev,
            status: "rejected",
            errorMessage: "Receiver declined the incoming transfer.",
          }));
          break;
        }
      }
    },
    [createPeerConnection, setupDataChannel, startHandshakeWatchdog, addLog]
  );

  const startSender = useCallback(
    async (customCode?: string): Promise<{ roomId: string; code: string }> => {
      cleanup();
      isCleaningUpRef.current = false;
      const currentSession = sessionGenRef.current;
      setRole("sender");
      setProgress({
        status: "connecting",
        itemType: "file",
        bytesTransferred: 0,
        totalBytes: 0,
        progressPercentage: 0,
        speedBps: 0,
      });

      connectStartTimeRef.current = Date.now();
      hasCheckedStatsRef.current = false;
      setDebugLog([]);
      setDiagnostics(getInitialDiagnostics());
      addLog("Sender started");

      const dynamicConfig = await fetchIceConfig(mode);
      rtcConfigRef.current = dynamicConfig;
      createPeerConnection("sender", dynamicConfig);

      const generatedCode = customCode ? normalizeRoomCode(customCode) : generateRoomCode();
      const newRoomId = `room_${generatedCode}`;
      setRoomId(newRoomId);
      setRoomCode(generatedCode);

      // PeerJS Cloud Broker & HTTP signal store initialization
      const initPeerJs = async () => {
        if (typeof window !== "undefined" && mode !== "hotspot") {
          try {
            const PeerClass = await loadPeerConstructor();
            if (sessionGenRef.current !== currentSession || !PeerClass || isConnectedRef.current) return;
            const peer = createPeerJsSender(PeerClass, generatedCode, {
              dynamicConfig,
              onConnection: (conn) => {
                dataConnRef.current = conn;
                hasSignalingActivityRef.current = true;
                if (conn.peerConnection) {
                  wirePeerJs(conn, "sender");
                } else {
                  const checkPc = setInterval(() => {
                    if (conn.peerConnection) {
                      clearInterval(checkPc);
                      wirePeerJs(conn, "sender");
                    }
                  }, 100);
                  setTimeout(() => clearInterval(checkPc), 2000);
                }

                const handleOpen = () => {
                  if (sessionGenRef.current !== currentSession) return;
                  if (activeTransportRef.current === "webrtc" && isConnectedRef.current) {
                    try {
                      conn.close();
                    } catch {
                      // Ignore
                    }
                    return;
                  }
                  clearHandshakeWatchdog();
                  clearReceiverWatchdogs();
                  activeTransportRef.current = "peerjs";
                  if (conn.dataChannel) {
                    dcRef.current = conn.dataChannel;
                  }
                  isConnectedRef.current = true;
                  setIsConnected(true);

                  if (pcRef.current) {
                    const rawPc = pcRef.current;
                    pcRef.current = null;
                    try {
                      rawPc.close();
                    } catch {
                      // Ignore
                    }
                  }
                };

                if (conn.open) {
                  handleOpen();
                } else {
                  conn.on("open", handleOpen);
                }
                conn.on("data", handleIncomingData);
                conn.on("close", () => {
                  if (activeTransportRef.current === "peerjs") {
                    isConnectedRef.current = false;
                    setIsConnected(false);
                  }
                });
                conn.on("error", (err) => console.debug("PeerJS conn error:", err));
              },
              onError: (errType) => {
                addLog(`PeerJS cloud broker notice: ${errType}. HTTP signaling fallback active.`);
                setDiagnostics((d) => ({
                  ...d,
                  lastError: `Cloud broker notice (${errType}). Using HTTP signaling fallback.`,
                }));
                setBrokerNotice("Cloud broker unavailable; direct relay fallback active.");
              },
            });
            peerInstanceRef.current = peer;
          } catch {
            // Ignore PeerJS load failure
          }
        }
      };

      const initSignaling = async () => {
        try {
          const { roomId: sigRoomId, code: sigCode } = await signalingRef.current.createRoom(generatedCode);
          if (sessionGenRef.current !== currentSession || !sigCode || isConnectedRef.current) return;
          setRoomId(sigRoomId);
          setRoomCode(sigCode);
          signalingRef.current.startPolling((msg) => {
            if (sessionGenRef.current === currentSession) {
              handleSignalMessage(msg, "sender");
            }
          });
        } catch (err) {
          addLog(`HTTP signaling room creation error: ${err}`);
        }
      };

      await Promise.all([initPeerJs(), initSignaling()]);

      return { roomId: newRoomId, code: generatedCode };
    },
    [
      cleanup,
      createPeerConnection,
      handleSignalMessage,
      handleIncomingData,
      clearReceiverWatchdogs,
      clearHandshakeWatchdog,
      wirePeerJs,
      mode,
      addLog,
    ]
  );

  const startReceiver = useCallback(
    async (code: string): Promise<void> => {
      cleanup();
      isCleaningUpRef.current = false;
      const currentSession = sessionGenRef.current;
      setRole("receiver");
      setProgress({
        status: "connecting",
        itemType: "file",
        bytesTransferred: 0,
        totalBytes: 0,
        progressPercentage: 0,
        speedBps: 0,
      });

      connectStartTimeRef.current = Date.now();
      hasCheckedStatsRef.current = false;
      setDebugLog([]);
      setDiagnostics(getInitialDiagnostics());
      addLog("Receiver started");

      hasSignalingActivityRef.current = false;
      roomNotFoundRef.current = false;
      clearReceiverWatchdogs();

      receiverSignalingWatchdogTimerRef.current = setTimeout(() => {
        if (sessionGenRef.current !== currentSession || isConnectedRef.current) return;
        if (!hasSignalingActivityRef.current || roomNotFoundRef.current) {
          addLog("12s signaling watchdog: room not found or sender offline");
        }
      }, 12000);

      receiverDialTimeoutRef.current = setTimeout(() => {
        if (sessionGenRef.current !== currentSession || isConnectedRef.current) return;
        addLog("15s receiver dial timeout: aborting connection attempt");
        clearHandshakeWatchdog();
        clearReceiverWatchdogs();
        isConnectedRef.current = false;
        setIsConnected(false);

        const isFirewallBlocked = hasSignalingActivityRef.current && !roomNotFoundRef.current;
        const errMsg = isFirewallBlocked ? FIREWALL_BLOCKED_MESSAGE : ROOM_NOT_FOUND_MESSAGE;

        setDiagnostics((d) => ({
          ...d,
          iceState: isFirewallBlocked ? "failed" : "closed",
          lastError: errMsg,
        }));

        setProgress((prev) => {
          if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) {
            return prev;
          }
          return { ...prev, status: "error", errorMessage: errMsg };
        });

        if (pcRef.current) {
          try {
            pcRef.current.close();
          } catch {
            // Ignore
          }
          pcRef.current = null;
        }
        if (dataConnRef.current) {
          try {
            dataConnRef.current.close();
          } catch {
            // Ignore
          }
          dataConnRef.current = null;
        }
        if (peerInstanceRef.current) {
          try {
            peerInstanceRef.current.destroy();
          } catch {
            // Ignore
          }
          peerInstanceRef.current = null;
        }
      }, 15000);

      const dynamicConfig = await fetchIceConfig(mode);
      rtcConfigRef.current = dynamicConfig;
      createPeerConnection("receiver", dynamicConfig);

      const cleanCode = normalizeRoomCode(code);
      const joinedRoomId = `room_${cleanCode}`;
      setRoomId(joinedRoomId);
      setRoomCode(cleanCode);

      // PeerJS Cloud Broker & HTTP signal store initialization
      const initPeerJs = async () => {
        if (typeof window !== "undefined" && mode !== "hotspot") {
          try {
            const PeerClass = await loadPeerConstructor();
            if (sessionGenRef.current !== currentSession || !PeerClass || isConnectedRef.current) return;
            const { peer, cleanup: receiverCleanup } = createPeerJsReceiver(PeerClass, cleanCode, {
              dynamicConfig,
              isSessionActive: () => sessionGenRef.current === currentSession && !isConnectedRef.current,
              onConnection: (conn) => {
                dataConnRef.current = conn;
                if (conn.peerConnection) {
                  wirePeerJs(conn, "receiver");
                } else {
                  const checkPc = setInterval(() => {
                    if (conn.peerConnection) {
                      clearInterval(checkPc);
                      wirePeerJs(conn, "receiver");
                    }
                  }, 100);
                  setTimeout(() => clearInterval(checkPc), 2000);
                }

                const handleOpen = () => {
                  if (sessionGenRef.current !== currentSession) return;
                  if (activeTransportRef.current === "webrtc" && isConnectedRef.current) {
                    try {
                      conn.close();
                    } catch {
                      // Ignore
                    }
                    return;
                  }
                  clearHandshakeWatchdog();
                  clearReceiverWatchdogs();
                  activeTransportRef.current = "peerjs";
                  if (conn.dataChannel) {
                    dcRef.current = conn.dataChannel;
                  }
                  isConnectedRef.current = true;
                  setIsConnected(true);

                  if (pcRef.current) {
                    const rawPc = pcRef.current;
                    pcRef.current = null;
                    try {
                      rawPc.close();
                    } catch {
                      // Ignore
                    }
                  }
                };

                if (conn.open) {
                  handleOpen();
                } else {
                  conn.on("open", handleOpen);
                }
                conn.on("data", handleIncomingData);
                conn.on("close", () => {
                  if (activeTransportRef.current === "peerjs") {
                    isConnectedRef.current = false;
                    setIsConnected(false);
                  }
                });
                conn.on("error", (err) => console.debug("PeerJS receiver conn error:", err));
              },
              onNotice: (type) => console.debug("PeerJS receiver notice (fallback active):", type),
            });

            peerInstanceRef.current = peer;
            peerReceiverCleanupRef.current = receiverCleanup;
          } catch {
            // Ignore PeerJS load failure
          }
        }
      };

      const initSignaling = async () => {
        try {
          const { roomId: sigRoomId, code: sigCode } = await signalingRef.current.joinRoom(cleanCode);
          if (sessionGenRef.current !== currentSession || !sigCode || isConnectedRef.current) return;
          hasSignalingActivityRef.current = true;
          setRoomId(sigRoomId);
          setRoomCode(sigCode);
          signalingRef.current.startPolling((msg) => {
            if (sessionGenRef.current === currentSession) {
              hasSignalingActivityRef.current = true;
              handleSignalMessage(msg, "receiver");
            }
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          addLog(`HTTP signaling join notice: ${msg}`);
          if (
            msg.toLowerCase().includes("not found") ||
            msg.toLowerCase().includes("expired") ||
            msg.toLowerCase().includes("404")
          ) {
            roomNotFoundRef.current = true;
          }
        }
      };

      await Promise.all([initPeerJs(), initSignaling()]);
    },
    [
      cleanup,
      createPeerConnection,
      handleSignalMessage,
      handleIncomingData,
      clearReceiverWatchdogs,
      clearHandshakeWatchdog,
      wirePeerJs,
      mode,
      addLog,
    ]
  );

  const sendFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const isChannelOpen = () => {
        if (dcRef.current && dcRef.current.readyState === "open") return true;
        if (dataConnRef.current && dataConnRef.current.open) return true;
        return false;
      };

      const isOpen = await waitForChannelOpen(isChannelOpen, 10000);
      if (!isOpen) {
        addLog("Channel open timeout (10s)");
        const errMsg = "Connection did not open. See Connection details.";
        setProgress((prev) => ({ ...prev, status: "error", errorMessage: errMsg }));
        setDiagnostics((d) => ({ ...d, lastError: errMsg }));
        return;
      }

      const channel = getActiveChannel();
      if (channel && ("bufferedAmountLowThreshold" in channel || typeof channel.bufferedAmountLowThreshold === "number")) {
        channel.bufferedAmountLowThreshold = BUFFER_THRESHOLD;
      }

      const totalBatchBytes = files.reduce((acc, f) => acc + f.size, 0);
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let accumulatedBatchBytes = 0;

      for (let i = 0; i < files.length; i++) {
        const currentFile = files[i];

        let sha256: string | null = null;
        if (currentFile.size <= MAX_CHECKSUM_FILE_SIZE) {
          sha256 = await computeSha256(currentFile);
        }

        const header = createFileHeader(currentFile, DEFAULT_CHUNK_SIZE, {
          batchId,
          fileIndex: i + 1,
          totalFiles: files.length,
          totalBatchBytes,
          sha256: sha256 || undefined,
        });

        setProgress({
          status: "transferring",
          itemType: "file",
          fileName: currentFile.name,
          fileSize: currentFile.size,
          bytesTransferred: 0,
          totalBytes: currentFile.size,
          progressPercentage: 0,
          speedBps: 0,
          batchId,
          fileIndex: i + 1,
          totalFiles: files.length,
          totalBatchBytes,
          batchBytesTransferred: accumulatedBatchBytes,
          sha256: sha256 || undefined,
          isVerified: Boolean(sha256),
        });

        sendRawData(JSON.stringify({ type: "header", header }));

        if (i === 0 && !hasAcceptedRef.current) {
          await new Promise<void>((resolve) => {
            acceptedResolverRef.current = resolve;
          });
          hasAcceptedRef.current = true;
        }

        startTimeRef.current = Date.now();
        const sentFileBytes = await streamBlobChunks(currentFile, DEFAULT_CHUNK_SIZE, {
          waitForDrain: () => waitForDrain(getActiveChannel(), BUFFER_THRESHOLD, 5000),
          sendRawData,
          onChunkSent: (sent, total, speed) => {
            const progressPercent = Math.min(100, Math.round((sent / (total || 1)) * 100));
            setProgress((prev) => ({
              ...prev,
              bytesTransferred: sent,
              progressPercentage: progressPercent,
              speedBps: speed,
              batchBytesTransferred: accumulatedBatchBytes + sent,
            }));
          },
        });

        accumulatedBatchBytes += sentFileBytes;

        const modeLabel =
          mode === "internet" ? "Via Internet" : mode === "same-network" ? "Same Wi-Fi" : "Hotspot";
        addTransferHistoryItem({
          direction: "sent",
          mode: modeLabel,
          itemType: "file",
          name: currentFile.name,
          size: currentFile.size,
          status: "completed",
        });

        if (i < files.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      }

      setProgress((prev) => ({
        ...prev,
        status: "completed",
        progressPercentage: 100,
        speedBps: 0,
      }));
    },
    [mode, sendRawData, getActiveChannel, addLog]
  );

  const sendText = useCallback(
    async (text: string) => {
      const isChannelOpen = () => {
        if (dcRef.current && dcRef.current.readyState === "open") return true;
        if (dataConnRef.current && dataConnRef.current.open) return true;
        return false;
      };

      const isOpen = await waitForChannelOpen(isChannelOpen, 10000);
      if (!isOpen) {
        addLog("Channel open timeout (10s)");
        const errMsg = "Connection did not open. See Connection details.";
        setProgress((prev) => ({ ...prev, status: "error", errorMessage: errMsg }));
        setDiagnostics((d) => ({ ...d, lastError: errMsg }));
        return;
      }

      const channel = getActiveChannel();
      if (channel && ("bufferedAmountLowThreshold" in channel || typeof channel.bufferedAmountLowThreshold === "number")) {
        channel.bufferedAmountLowThreshold = BUFFER_THRESHOLD;
      }

      const header = createTextHeader(text, DEFAULT_CHUNK_SIZE);
      const blobToSend = new Blob([text], { type: "text/plain;charset=utf-8" });
      const totalBytes = blobToSend.size;

      setProgress({
        status: "transferring",
        itemType: "text",
        textPreview: header.text?.preview,
        bytesTransferred: 0,
        totalBytes,
        progressPercentage: 0,
        speedBps: 0,
      });

      sendRawData(JSON.stringify({ type: "header", header }));

      startTimeRef.current = Date.now();
      await streamBlobChunks(blobToSend, DEFAULT_CHUNK_SIZE, {
        waitForDrain: () => waitForDrain(getActiveChannel(), BUFFER_THRESHOLD, 5000),
        sendRawData,
        onChunkSent: (sent, total, speed) => {
          const progressPercent = Math.min(100, Math.round((sent / (total || 1)) * 100));
          setProgress((prev) => ({
            ...prev,
            bytesTransferred: sent,
            progressPercentage: progressPercent,
            speedBps: speed,
          }));
        },
      });

      addTransferHistoryItem({
        direction: "sent",
        mode: mode === "internet" ? "Via Internet" : mode === "same-network" ? "Same Wi-Fi" : "Hotspot",
        itemType: "text",
        name: text.length > 30 ? `${text.slice(0, 30)}...` : text,
        textSnippet: text,
        size: totalBytes,
        status: "completed",
      });

      setProgress((prev) => ({
        ...prev,
        status: "completed",
        progressPercentage: 100,
        speedBps: 0,
      }));
    },
    [mode, sendRawData, getActiveChannel, addLog]
  );

  const sendPayload = useCallback(
    async (payload: { files?: File[]; file?: File; text?: string }) => {
      if (payload.files && payload.files.length > 0) {
        await sendFiles(payload.files);
      } else if (payload.file) {
        await sendFiles([payload.file]);
      } else if (payload.text) {
        await sendText(payload.text);
      } else {
        throw new Error("No file or text provided to transfer");
      }
    },
    [sendFiles, sendText]
  );

  const acceptIncomingTransfer = useCallback(async () => {
    const header = currentHeaderRef.current;

    if (header?.file && header.file.size > DISK_STREAM_THRESHOLD && isFileSystemAccessSupported()) {
      try {
        const writer = await createDiskStreamWriter(header.file.name);
        if (writer) {
          diskWriterRef.current = writer;
        }
      } catch {
        // Fall back to Blob
      }
    }

    if (header?.batchId) {
      hasReceiverAcceptedBatchRef.current = header.batchId;
    }

    sendRawData(JSON.stringify({ type: "transfer-accepted" }));
    signalingRef.current.sendSignal("transfer-accepted").catch(() => {});

    setProgress((prev) => ({
      ...prev,
      status: "transferring",
    }));
  }, [sendRawData]);

  const rejectIncomingTransfer = useCallback(() => {
    sendRawData(JSON.stringify({ type: "transfer-rejected" }));
    signalingRef.current.sendSignal("transfer-rejected").catch(() => {});
    setProgress((prev) => ({
      ...prev,
      status: "rejected",
    }));
    cleanup();
  }, [cleanup, sendRawData]);

  return {
    role,
    roomId,
    roomCode,
    isConnected,
    progress,
    pendingHeader,
    brokerNotice,
    startSender,
    startReceiver,
    sendFiles,
    sendText,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
    debugLog,
    diagnostics,
  };
}

export default useWebRTC;
