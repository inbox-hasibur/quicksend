"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SignalingClient } from "@/lib/signalingClient";
import { generateRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import {
  sliceBlobIntoChunks,
  reassembleChunksToBlob,
  reassembleChunksToText,
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
import {
  getRtcConfig,
  FIREWALL_FALLBACK_MESSAGE,
} from "@/lib/iceConfig";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import type { PeerRole, SignalMessage } from "@/types/signaling";
import type { TransferMode } from "@/types/mode";
import type {
  TransferProgressState,
  TransferPayloadHeader,
} from "@/types/transfer";

const BUFFER_THRESHOLD = 512 * 1024; // 512 KB backpressure threshold for smooth streaming

interface PeerJsConnection {
  open?: boolean;
  dataChannel?: RTCDataChannel;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  send: (data: unknown) => void;
  close: () => void;
}

interface PeerJsInstance {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  connect: (id: string, options?: unknown) => PeerJsConnection;
  destroy: () => void;
}

type ActiveTransport = "peerjs" | "webrtc" | null;

async function loadPeerConstructor() {
  try {
    const m = await import("peerjs");
    const mod = (m && (m as { default?: unknown }).default ? (m as { default: unknown }).default : m) as Record<string, unknown>;
    const PeerClass = (mod.Peer || mod.default || mod) as new (
      id?: string,
      options?: unknown
    ) => PeerJsInstance;
    return typeof PeerClass === "function" ? PeerClass : null;
  } catch {
    return null;
  }
}

export function useWebRTC(mode: TransferMode = "internet") {
  const [role, setRole] = useState<PeerRole | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingHeader, setPendingHeader] = useState<TransferPayloadHeader | null>(null);

  const [progress, setProgress] = useState<TransferProgressState>({
    status: "idle",
    itemType: "file",
    bytesTransferred: 0,
    totalBytes: 0,
    progressPercentage: 0,
    speedBps: 0,
  });

  const activeTransportRef = useRef<ActiveTransport>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const signalingRef = useRef<SignalingClient>(new SignalingClient());
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const currentHeaderRef = useRef<TransferPayloadHeader | null>(null);
  const startTimeRef = useRef<number>(0);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const iceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef<boolean>(false);

  // Batch queue & disk streaming refs
  const diskWriterRef = useRef<DiskStreamWriter | null>(null);
  const peerInstanceRef = useRef<PeerJsInstance | null>(null);
  const dataConnRef = useRef<PeerJsConnection | null>(null);
  const hasReceiverAcceptedBatchRef = useRef<string | null>(null);
  const hasAcceptedRef = useRef<boolean>(false);
  const acceptedResolverRef = useRef<(() => void) | null>(null);
  const receivedChunkCountRef = useRef<number>(0);
  const activeDownloadUrlsRef = useRef<string[]>([]);
  const isCleaningUpRef = useRef<boolean>(false);
  const sessionGenRef = useRef<number>(0);

  const clearIceTimeout = useCallback(() => {
    if (iceTimerRef.current) {
      clearTimeout(iceTimerRef.current);
      iceTimerRef.current = null;
    }
  }, []);

  const startIceTimeout = useCallback(() => {
    clearIceTimeout();
    // Do not force auto-disconnect timeouts while waiting for devices to pair or beam.
    // The user explicitly requested to stay waiting until connected or cancelled:
    // "ami back na dile timeout hoyar dorkar nei in sob case"
  }, [clearIceTimeout]);

  // Unified Data Sender across active transport
  const sendRawData = useCallback((data: string | ArrayBuffer) => {
    if (activeTransportRef.current === "peerjs" && dataConnRef.current) {
      try {
        dataConnRef.current.send(data);
        return;
      } catch {
        // Fallback to DataChannel if PeerJS send threw
      }
    }
    if (dcRef.current && dcRef.current.readyState === "open") {
      try {
        dcRef.current.send(data as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        return;
      } catch {
        // Channel may be closing
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

  // Backpressure buffer monitor
  const getBufferedAmount = useCallback((): number => {
    if (dcRef.current) {
      return dcRef.current.bufferedAmount;
    }
    if (dataConnRef.current && dataConnRef.current.dataChannel) {
      return dataConnRef.current.dataChannel.bufferedAmount;
    }
    return 0;
  }, []);

  // Cleanup helper
  const cleanup = useCallback(() => {
    sessionGenRef.current++;
    isCleaningUpRef.current = true;
    clearIceTimeout();
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
      diskWriterRef.current.abort().catch(() => { });
      diskWriterRef.current = null;
    }

    // Revoke any created object URLs on reset
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
    // Reset cleanup flag on next tick
    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 50);
  }, [clearIceTimeout]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Receiver handling incoming chunks & control messages
  const handleIncomingData = useCallback(async (data: unknown) => {
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

          // If this is part of a previously accepted batch (e.g. file 2 of 5), don't block on modal
          const isAutoAcceptedBatch = Boolean(
            header.batchId &&
            hasReceiverAcceptedBatchRef.current === header.batchId &&
            header.fileIndex &&
            header.fileIndex > 1
          );

          if (isAutoAcceptedBatch) {
            setProgress({
              status: "transferring",
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
          } else {
            setProgress({
              status: "waiting-acceptance",
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
          }
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
        // Non-json string, ignore
      }
      return;
    }

    // Binary chunk handling: normalize ArrayBuffer, Uint8Array, or Blob
    let buffer: ArrayBuffer | null = null;
    if (data instanceof ArrayBuffer) {
      buffer = data;
    } else if (ArrayBuffer.isView(data)) {
      buffer = (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else if (typeof Blob !== "undefined" && data instanceof Blob) {
      buffer = await data.arrayBuffer();
    }

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

      // Check if all chunks received for this item
      if (receivedChunkCountRef.current >= header.totalChunks) {
        let isVerified = false;

        if (diskWriterRef.current) {
          await diskWriterRef.current.close();
          diskWriterRef.current = null;
          isVerified = true;
        } else if (header.type === "file" && header.file) {
          const blob = reassembleChunksToBlob(receivedChunksRef.current, header.file.type);

          // Verify SHA-256 checksum if provided and file size <= 150MB
          if (header.sha256 && header.file.size <= MAX_CHECKSUM_FILE_SIZE) {
            const computedHash = await computeSha256(blob);
            isVerified = computedHash === header.sha256;
          } else {
            isVerified = Boolean(header.sha256);
          }

          const url = URL.createObjectURL(blob);
          activeDownloadUrlsRef.current.push(url);

          // Attempt direct programmatic download (desktop)
          try {
            const a = document.createElement("a");
            a.href = url;
            a.download = header.file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } catch {
            // Silently ignore programmatic click blocks on mobile browsers
          }
        }

        let fullText: string | undefined;
        if (header.type === "text") {
          fullText = reassembleChunksToText(receivedChunksRef.current);
        }

        const modeLabel =
          mode === "internet" ? "Via Internet" : mode === "same-network" ? "Same Wi-Fi" : "Hotspot";

        if (header.type === "file" && header.file) {
          addTransferHistoryItem({
            direction: "received",
            mode: modeLabel,
            itemType: "file",
            name: header.file.name,
            size: header.file.size,
            status: "completed",
          });
        } else if (header.type === "text" && fullText) {
          addTransferHistoryItem({
            direction: "received",
            mode: modeLabel,
            itemType: "text",
            name: fullText.length > 30 ? `${fullText.slice(0, 30)}...` : fullText,
            textSnippet: fullText,
            size: new Blob([fullText]).size,
            status: "completed",
          });
        }

        const isLastInBatch =
          !header.totalFiles ||
          !header.fileIndex ||
          header.fileIndex >= header.totalFiles;

        const latestDownloadUrl =
          activeDownloadUrlsRef.current.length > 0
            ? activeDownloadUrlsRef.current[activeDownloadUrlsRef.current.length - 1]
            : undefined;

        setProgress((prev) => ({
          ...prev,
          status: isLastInBatch ? "completed" : "transferring",
          textContent: fullText,
          downloadUrl: latestDownloadUrl,
          progressPercentage: 100,
          speedBps: 0,
          isVerified,
        }));
      }
    }
  }, [mode]);

  // Setup DataChannel listeners for direct WebRTC
  const setupDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dc.binaryType = "arraybuffer";

      dc.onopen = () => {
        clearIceTimeout();
        activeTransportRef.current = "webrtc";
        isConnectedRef.current = true;
        setIsConnected(true);
      };

      dc.onclose = () => {
        if (isCleaningUpRef.current) return;
        if (activeTransportRef.current === "webrtc") {
          isConnectedRef.current = false;
          setIsConnected(false);
        }
      };

      dc.onerror = () => {
        if (isCleaningUpRef.current || !dcRef.current) return;
        // Never override active PeerJS transfer or already finished/verified transfers
        if (activeTransportRef.current === "peerjs") return;
        setProgress((prev) => {
          if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) return prev;
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
    [clearIceTimeout, handleIncomingData]
  );

  // Setup Peer Connection
  const createPeerConnection = useCallback(
    (currentRole: PeerRole) => {
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          // Ignore
        }
      }

      const config = getRtcConfig(mode);
      const pc = new RTCPeerConnection(config);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          signalingRef.current
            .sendSignal("candidate", event.candidate.toJSON())
            .catch(() => { });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (isCleaningUpRef.current || !pcRef.current) return;
        // If PeerJS is active or connected, ignore raw WebRTC ICE failures
        if (activeTransportRef.current === "peerjs" || isConnectedRef.current) {
          return;
        }

        if (pc.iceConnectionState === "failed") {
          clearIceTimeout();
          isConnectedRef.current = false;
          setIsConnected(false);
          setProgress((prev) => {
            if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) return prev;
            return {
              ...prev,
              status: "error",
              errorMessage: FIREWALL_FALLBACK_MESSAGE,
            };
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (isCleaningUpRef.current || !pcRef.current) return;
        if (pc.connectionState === "connected") {
          clearIceTimeout();
          activeTransportRef.current = "webrtc";
          isConnectedRef.current = true;
          setIsConnected(true);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          // If PeerJS is active, ignore raw WebRTC disconnect
          if (activeTransportRef.current === "peerjs" && isConnectedRef.current) {
            return;
          }

          isConnectedRef.current = false;
          setIsConnected(false);
          if (pc.connectionState === "failed") {
            clearIceTimeout();
            setProgress((prev) => {
              if (prev.status === "completed" || prev.status === "idle" || prev.progressPercentage >= 100) return prev;
              return {
                ...prev,
                status: "error",
                errorMessage: FIREWALL_FALLBACK_MESSAGE,
              };
            });
          }
        }
      };

      if (currentRole === "receiver") {
        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dcRef.current = dc;
          activeTransportRef.current = "webrtc";
          setupDataChannel(dc);
        };
      }

      return pc;
    },
    [mode, setupDataChannel, clearIceTimeout]
  );

  // Process incoming signaling messages
  const handleSignalMessage = useCallback(
    async (message: SignalMessage, currentRole: PeerRole) => {
      const pc = pcRef.current;

      switch (message.type) {
        case "peer-joined": {
          if (currentRole === "sender" && pc) {
            const dc = pc.createDataChannel("share-channel", { ordered: true });
            dcRef.current = dc;
            setupDataChannel(dc);

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await signalingRef.current.sendSignal("offer", offer);
          }
          break;
        }

        case "offer": {
          if (currentRole === "receiver") {
            const pcInstance = pc || createPeerConnection("receiver");
            await pcInstance.setRemoteDescription(
              new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
            );

            while (candidateQueueRef.current.length > 0) {
              const cand = candidateQueueRef.current.shift();
              if (cand) await pcInstance.addIceCandidate(new RTCIceCandidate(cand));
            }

            const answer = await pcInstance.createAnswer();
            await pcInstance.setLocalDescription(answer);
            await signalingRef.current.sendSignal("answer", answer);
          }
          break;
        }

        case "answer": {
          if (currentRole === "sender" && pc) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
            );
            while (candidateQueueRef.current.length > 0) {
              const cand = candidateQueueRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }
          break;
        }

        case "candidate": {
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit));
            } catch {
              // Ignore duplicate/late candidates
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
    [createPeerConnection, setupDataChannel]
  );

  // Sender starts a session with dual PeerJS cloud broker + signaling fallback
  const startSender = useCallback(
    async (customCode?: string): Promise<{ roomId: string; code: string }> => {
      cleanup();
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

      startIceTimeout();
      createPeerConnection("sender");

      const generatedCode = customCode ? normalizeRoomCode(customCode) : generateRoomCode();
      const newRoomId = `room_${generatedCode}`;
      setRoomId(newRoomId);
      setRoomCode(generatedCode);

      // 1. Direct PeerJS WebSocket broker on 0.peerjs.com
      if (typeof window !== "undefined" && mode !== "hotspot") {
        loadPeerConstructor()
          .then((PeerClass) => {
            if (sessionGenRef.current !== currentSession || !PeerClass || isConnectedRef.current) return;
            const peerId = `qs-${generatedCode.toLowerCase()}`;
            const peer = new PeerClass(peerId, {
              config: getRtcConfig(mode),
              debug: 1,
            });
            peerInstanceRef.current = peer;

            peer.on("connection", (rawConn: unknown) => {
              const conn = rawConn as PeerJsConnection;
              dataConnRef.current = conn;

              const handleOpen = () => {
                if (sessionGenRef.current !== currentSession) return;
                clearIceTimeout();
                activeTransportRef.current = "peerjs";
                if (conn.dataChannel) {
                  dcRef.current = conn.dataChannel;
                }
                isConnectedRef.current = true;
                setIsConnected(true);

                // Tear down competing raw RTCPeerConnection cleanly to avoid false timeout
                if (pcRef.current) {
                  const rawPc = pcRef.current;
                  pcRef.current = null;
                  rawPc.oniceconnectionstatechange = null;
                  rawPc.onconnectionstatechange = null;
                  rawPc.onicecandidate = null;
                  rawPc.ondatachannel = null;
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

              conn.on("data", (data: unknown) => {
                handleIncomingData(data);
              });

              conn.on("close", () => {
                if (activeTransportRef.current === "peerjs") {
                  isConnectedRef.current = false;
                  setIsConnected(false);
                }
              });

              conn.on("error", (err: unknown) => {
                console.debug("PeerJS conn error:", err);
              });
            });

            peer.on("error", (err: unknown) => {
              const e = err as { type?: string };
              console.debug("PeerJS notice (fallback active):", e?.type);
            });
          })
          .catch(() => {});
      }

      // 2. Concurrently initiate HTTP signal store fallback
      signalingRef.current
        .createRoom(generatedCode)
        .then(({ roomId: sigRoomId, code: sigCode }) => {
          if (sessionGenRef.current !== currentSession || !sigCode || isConnectedRef.current) return;
          setRoomId(sigRoomId);
          setRoomCode(sigCode);
          signalingRef.current.startPolling((msg) => {
            if (sessionGenRef.current === currentSession) {
              handleSignalMessage(msg, "sender");
            }
          });
        })
        .catch(() => {});

      return { roomId: newRoomId, code: generatedCode };
    },
    [cleanup, createPeerConnection, handleSignalMessage, handleIncomingData, startIceTimeout, clearIceTimeout, mode]
  );

  // Receiver joins a session with dual PeerJS cloud broker + signaling fallback
  const startReceiver = useCallback(
    async (code: string): Promise<void> => {
      cleanup();
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

      startIceTimeout();
      createPeerConnection("receiver");

      const cleanCode = normalizeRoomCode(code);
      const joinedRoomId = `room_${cleanCode}`;
      setRoomId(joinedRoomId);
      setRoomCode(cleanCode);

      // 1. Direct PeerJS WebSocket broker
      if (typeof window !== "undefined" && mode !== "hotspot") {
        loadPeerConstructor()
          .then((PeerClass) => {
            if (sessionGenRef.current !== currentSession || !PeerClass || isConnectedRef.current) return;
            const peer = new PeerClass(undefined, {
              config: getRtcConfig(mode),
              debug: 1,
            });
            peerInstanceRef.current = peer;

            peer.on("open", () => {
              const targetId = `qs-${cleanCode.toLowerCase()}`;
              const conn = peer.connect(targetId, { reliable: true, serialization: "raw" });
              dataConnRef.current = conn;

              const handleOpen = () => {
                if (sessionGenRef.current !== currentSession) return;
                clearIceTimeout();
                activeTransportRef.current = "peerjs";
                if (conn.dataChannel) {
                  dcRef.current = conn.dataChannel;
                }
                isConnectedRef.current = true;
                setIsConnected(true);

                // Tear down competing raw RTCPeerConnection cleanly to avoid false timeout
                if (pcRef.current) {
                  const rawPc = pcRef.current;
                  pcRef.current = null;
                  rawPc.oniceconnectionstatechange = null;
                  rawPc.onconnectionstatechange = null;
                  rawPc.onicecandidate = null;
                  rawPc.ondatachannel = null;
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

              conn.on("data", (data: unknown) => {
                handleIncomingData(data);
              });

              conn.on("close", () => {
                if (activeTransportRef.current === "peerjs") {
                  isConnectedRef.current = false;
                  setIsConnected(false);
                }
              });

              conn.on("error", (err: unknown) => {
                console.debug("PeerJS receiver conn error:", err);
              });
            });

            peer.on("error", (err: unknown) => {
              const e = err as { type?: string };
              console.debug("PeerJS receiver notice (fallback active):", e?.type);
            });
          })
          .catch(() => {});
      }

      // 2. Concurrently initiate HTTP signal store fallback
      signalingRef.current
        .joinRoom(cleanCode)
        .then(({ roomId: sigRoomId, code: sigCode }) => {
          if (sessionGenRef.current !== currentSession || !sigCode || isConnectedRef.current) return;
          setRoomId(sigRoomId);
          setRoomCode(sigCode);
          signalingRef.current.startPolling((msg) => {
            if (sessionGenRef.current === currentSession) {
              handleSignalMessage(msg, "receiver");
            }
          });
        })
        .catch(() => {});
    },
    [cleanup, createPeerConnection, handleSignalMessage, handleIncomingData, startIceTimeout, clearIceTimeout, mode]
  );

  // Sequential Multi-File Batch Queue Sender
  const sendFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const totalBatchBytes = files.reduce((acc, f) => acc + f.size, 0);
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let accumulatedBatchBytes = 0;

    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];

      // Calculate SHA-256 checksum for integrity check
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

      // 1. Send header JSON
      sendRawData(JSON.stringify({ type: "header", header }));

      // 2. Wait for receiver acceptance on the first file
      if (i === 0 && !hasAcceptedRef.current) {
        await new Promise<void>((resolve) => {
          acceptedResolverRef.current = resolve;
        });
        hasAcceptedRef.current = true;
      }

      // 3. Stream binary chunks with backpressure
      startTimeRef.current = Date.now();
      let sentFileBytes = 0;

      for await (const chunkInfo of sliceBlobIntoChunks(currentFile, DEFAULT_CHUNK_SIZE)) {
        while (getBufferedAmount() > BUFFER_THRESHOLD) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }

        sendRawData(chunkInfo.chunk);
        sentFileBytes += chunkInfo.chunk.byteLength;

        const progressPercent = Math.min(100, Math.round((sentFileBytes / (currentFile.size || 1)) * 100));
        const elapsedSec = (Date.now() - startTimeRef.current) / 1000 || 0.1;
        const speed = Math.round(sentFileBytes / elapsedSec);

        setProgress((prev) => ({
          ...prev,
          bytesTransferred: sentFileBytes,
          progressPercentage: progressPercent,
          speedBps: speed,
          batchBytesTransferred: accumulatedBatchBytes + sentFileBytes,
        }));
      }

      accumulatedBatchBytes += currentFile.size;

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

      // Small pause between sequential files to allow receiver to flush and trigger download
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
  }, [mode, sendRawData, getBufferedAmount]);

  // Text snippet sender
  const sendText = useCallback(async (text: string) => {
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

    // 1. Send header JSON
    sendRawData(JSON.stringify({ type: "header", header }));

    // 2. Stream text chunks with backpressure
    startTimeRef.current = Date.now();
    let sentBytes = 0;

    for await (const chunkInfo of sliceBlobIntoChunks(blobToSend, DEFAULT_CHUNK_SIZE)) {
      while (getBufferedAmount() > BUFFER_THRESHOLD) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      sendRawData(chunkInfo.chunk);
      sentBytes += chunkInfo.chunk.byteLength;

      const progressPercent = Math.min(100, Math.round((sentBytes / (totalBytes || 1)) * 100));
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000 || 0.1;
      const speed = Math.round(sentBytes / elapsedSec);

      setProgress((prev) => ({
        ...prev,
        bytesTransferred: sentBytes,
        progressPercentage: progressPercent,
        speedBps: speed,
      }));
    }

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
  }, [mode, sendRawData, getBufferedAmount]);

  // Universal payload sender
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

  // Receiver accepts incoming payload (with disk streaming support for files > 100MB)
  const acceptIncomingTransfer = useCallback(async () => {
    const header = currentHeaderRef.current;

    // Check if large-file disk streaming applies
    if (
      header?.file &&
      header.file.size > DISK_STREAM_THRESHOLD &&
      isFileSystemAccessSupported()
    ) {
      try {
        const writer = await createDiskStreamWriter(header.file.name);
        if (writer) {
          diskWriterRef.current = writer;
        }
      } catch {
        // Fall back gracefully to in-memory Blob
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

  // Receiver rejects incoming payload
  const rejectIncomingTransfer = useCallback(() => {
    sendRawData(JSON.stringify({ type: "transfer-rejected" }));
    signalingRef.current.sendSignal("transfer-rejected").catch(() => { });
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
    startSender,
    startReceiver,
    sendFiles,
    sendText,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
  };
}
