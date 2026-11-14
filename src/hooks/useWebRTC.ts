"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SignalingClient } from "@/lib/signalingClient";
import {
  sliceBlobIntoChunks,
  reassembleChunksToBlob,
  reassembleChunksToText,
  createFileHeader,
  createTextHeader,
  DEFAULT_CHUNK_SIZE,
} from "@/lib/chunker";
import {
  getRtcConfig,
  ICE_CONNECTION_TIMEOUT_MS,
  FIREWALL_FALLBACK_MESSAGE,
} from "@/lib/iceConfig";
import type { PeerRole, SignalMessage } from "@/types/signaling";
import type { TransferMode } from "@/types/mode";
import type {
  TransferProgressState,
  TransferPayloadHeader,
} from "@/types/transfer";

const BUFFER_THRESHOLD = 1024 * 1024; // 1 MB backpressure threshold

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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const signalingRef = useRef<SignalingClient>(new SignalingClient());
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const currentHeaderRef = useRef<TransferPayloadHeader | null>(null);
  const startTimeRef = useRef<number>(0);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const iceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef<boolean>(false);

  const clearIceTimeout = useCallback(() => {
    if (iceTimerRef.current) {
      clearTimeout(iceTimerRef.current);
      iceTimerRef.current = null;
    }
  }, []);

  const startIceTimeout = useCallback(() => {
    clearIceTimeout();
    iceTimerRef.current = setTimeout(() => {
      if (!isConnectedRef.current) {
        setProgress((prev) => {
          if (prev.status === "connecting") {
            return {
              ...prev,
              status: "error",
              errorMessage: FIREWALL_FALLBACK_MESSAGE,
            };
          }
          return prev;
        });
      }
    }, ICE_CONNECTION_TIMEOUT_MS);
  }, [clearIceTimeout]);

  // Cleanup helper
  const cleanup = useCallback(() => {
    clearIceTimeout();
    isConnectedRef.current = false;
    signalingRef.current.leaveRoom();
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    receivedChunksRef.current = [];
    currentHeaderRef.current = null;
    candidateQueueRef.current = [];
    setIsConnected(false);
    setPendingHeader(null);
  }, [clearIceTimeout]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Receiver handling incoming chunks
  const handleIncomingData = useCallback((data: unknown) => {
    if (typeof data === "string") {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "header") {
          const header: TransferPayloadHeader = msg.header;
          currentHeaderRef.current = header;
          setPendingHeader(header);
          receivedChunksRef.current = [];
          startTimeRef.current = Date.now();

          const totalBytes =
            header.type === "file" ? header.file?.size || 0 : header.text?.length || 0;

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
          });
        }
      } catch {
        // Non-json string, ignore
      }
    } else if (data instanceof ArrayBuffer) {
      receivedChunksRef.current.push(data);
      const header = currentHeaderRef.current;
      if (!header) return;

      const totalBytes =
        header.type === "file" ? header.file?.size || 0 : header.text?.length || 0;

      const currentBytes = receivedChunksRef.current.reduce(
        (acc, chunk) => acc + chunk.byteLength,
        0
      );

      const progressPercent = Math.min(100, Math.round((currentBytes / totalBytes) * 100));
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000 || 0.1;
      const speed = Math.round(currentBytes / elapsedSec);

      setProgress((prev) => ({
        ...prev,
        status: "transferring",
        bytesTransferred: currentBytes,
        progressPercentage: progressPercent,
        speedBps: speed,
      }));

      // Check if all chunks received
      if (receivedChunksRef.current.length >= header.totalChunks) {
        if (header.type === "file" && header.file) {
          const blob = reassembleChunksToBlob(receivedChunksRef.current, header.file.type);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = header.file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        let fullText: string | undefined;
        if (header.type === "text") {
          fullText = reassembleChunksToText(receivedChunksRef.current);
        }

        setProgress((prev) => ({
          ...prev,
          status: "completed",
          textContent: fullText,
          progressPercentage: 100,
          speedBps: 0,
        }));
      }
    }
  }, []);

  // Setup DataChannel listeners
  const setupDataChannel = useCallback(
    (dc: RTCDataChannel, currentRole: PeerRole) => {
      dc.binaryType = "arraybuffer";

      dc.onopen = () => {
        clearIceTimeout();
        isConnectedRef.current = true;
        setIsConnected(true);
      };

      dc.onclose = () => {
        isConnectedRef.current = false;
        setIsConnected(false);
      };

      dc.onerror = () => {
        setProgress((prev) => ({
          ...prev,
          status: "error",
          errorMessage: "DataChannel error occurred during transfer.",
        }));
      };

      if (currentRole === "receiver") {
        dc.onmessage = (event) => {
          handleIncomingData(event.data);
        };
      } else {
        dc.onmessage = (event) => {
          if (typeof event.data === "string") {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === "transfer-accepted") {
                // Receiver accepted, transmission begins
              }
            } catch {
              // Ignore non-json
            }
          }
        };
      }
    },
    [handleIncomingData, clearIceTimeout]
  );

  // Setup Peer Connection
  const createPeerConnection = useCallback(
    (currentRole: PeerRole) => {
      if (pcRef.current) {
        pcRef.current.close();
      }

      const config = getRtcConfig(mode);
      const pc = new RTCPeerConnection(config);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          signalingRef.current
            .sendSignal("candidate", event.candidate.toJSON())
            .catch(() => {});
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          clearIceTimeout();
          isConnectedRef.current = false;
          setIsConnected(false);
          setProgress((prev) => ({
            ...prev,
            status: "error",
            errorMessage: FIREWALL_FALLBACK_MESSAGE,
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          clearIceTimeout();
          isConnectedRef.current = true;
          setIsConnected(true);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          isConnectedRef.current = false;
          setIsConnected(false);
          if (pc.connectionState === "failed") {
            clearIceTimeout();
            setProgress((prev) => ({
              ...prev,
              status: "error",
              errorMessage: FIREWALL_FALLBACK_MESSAGE,
            }));
          }
        }
      };

      if (currentRole === "receiver") {
        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dcRef.current = dc;
          setupDataChannel(dc, "receiver");
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
            // Receiver joined! Sender creates DataChannel and offer
            const dc = pc.createDataChannel("share-channel", { ordered: true });
            dcRef.current = dc;
            setupDataChannel(dc, "sender");

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

            // Drain queued ICE candidates
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
          // Sender notified of receiver acceptance
          break;
        }

        case "transfer-rejected": {
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

  // Sender starts a session
  const startSender = useCallback(
    async (customCode?: string): Promise<{ roomId: string; code: string }> => {
      cleanup();
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
      const { roomId: newRoomId, code: newCode } = await signalingRef.current.createRoom(customCode);
      setRoomId(newRoomId);
      setRoomCode(newCode);

      signalingRef.current.startPolling((msg) => handleSignalMessage(msg, "sender"));

      return { roomId: newRoomId, code: newCode };
    },
    [cleanup, createPeerConnection, handleSignalMessage, startIceTimeout]
  );

  // Receiver joins a session
  const startReceiver = useCallback(
    async (code: string): Promise<void> => {
      cleanup();
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
      const { roomId: joinedRoomId, code: verifiedCode } = await signalingRef.current.joinRoom(code);
      setRoomId(joinedRoomId);
      setRoomCode(verifiedCode);

      signalingRef.current.startPolling((msg) => handleSignalMessage(msg, "receiver"));
    },
    [cleanup, createPeerConnection, handleSignalMessage, startIceTimeout]
  );

  // Sender sends payload (File or Text)
  const sendPayload = useCallback(async (payload: { file?: File; text?: string }) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      throw new Error("WebRTC DataChannel is not open for transfer");
    }

    const { file, text } = payload;
    let header: TransferPayloadHeader;
    let blobToSend: Blob;

    if (file) {
      header = createFileHeader(file);
      blobToSend = file;
    } else if (text) {
      header = createTextHeader(text);
      blobToSend = new Blob([text], { type: "text/plain;charset=utf-8" });
    } else {
      throw new Error("No file or text provided to transfer");
    }

    const totalBytes = blobToSend.size;
    setProgress({
      status: "transferring",
      itemType: header.type,
      fileName: file?.name,
      fileSize: file?.size,
      textPreview: header.text?.preview,
      bytesTransferred: 0,
      totalBytes,
      progressPercentage: 0,
      speedBps: 0,
    });

    // 1. Send header JSON
    dc.send(JSON.stringify({ type: "header", header }));

    // 2. Stream binary chunks with backpressure
    startTimeRef.current = Date.now();
    let sentBytes = 0;

    for await (const chunkInfo of sliceBlobIntoChunks(blobToSend, DEFAULT_CHUNK_SIZE)) {
      // Manage buffer backpressure
      while (dc.bufferedAmount > BUFFER_THRESHOLD) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      dc.send(chunkInfo.chunk);
      sentBytes += chunkInfo.chunk.byteLength;

      const progressPercent = Math.min(100, Math.round((sentBytes / totalBytes) * 100));
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000 || 0.1;
      const speed = Math.round(sentBytes / elapsedSec);

      setProgress((prev) => ({
        ...prev,
        bytesTransferred: sentBytes,
        progressPercentage: progressPercent,
        speedBps: speed,
      }));
    }

    setProgress((prev) => ({
      ...prev,
      status: "completed",
      progressPercentage: 100,
      speedBps: 0,
    }));
  }, []);

  // Receiver accepts incoming payload
  const acceptIncomingTransfer = useCallback(() => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "transfer-accepted" }));
    }
    setProgress((prev) => ({
      ...prev,
      status: "transferring",
    }));
  }, []);

  // Receiver rejects incoming payload
  const rejectIncomingTransfer = useCallback(() => {
    signalingRef.current.sendSignal("transfer-rejected").catch(() => {});
    setProgress((prev) => ({
      ...prev,
      status: "rejected",
    }));
    cleanup();
  }, [cleanup]);

  return {
    role,
    roomId,
    roomCode,
    isConnected,
    progress,
    pendingHeader,
    startSender,
    startReceiver,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
  };
}
