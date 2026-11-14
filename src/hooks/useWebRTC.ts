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
  ICE_CONNECTION_TIMEOUT_MS,
  FIREWALL_FALLBACK_MESSAGE,
} from "@/lib/iceConfig";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
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

  // Batch queue & disk streaming refs
  const diskWriterRef = useRef<DiskStreamWriter | null>(null);
  const peerInstanceRef = useRef<unknown>(null);
  const dataConnRef = useRef<unknown>(null);
  const hasReceiverAcceptedBatchRef = useRef<string | null>(null);
  const hasAcceptedRef = useRef<boolean>(false);
  const acceptedResolverRef = useRef<(() => void) | null>(null);
  const receivedChunkCountRef = useRef<number>(0);

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
    hasAcceptedRef.current = false;
    hasReceiverAcceptedBatchRef.current = null;
    if (acceptedResolverRef.current) {
      acceptedResolverRef.current = null;
    }
    if (diskWriterRef.current) {
      diskWriterRef.current.abort().catch(() => { });
      diskWriterRef.current = null;
    }

    if (dataConnRef.current) {
      try {
        (dataConnRef.current as { close: () => void }).close();
      } catch {
        // Ignore
      }
      dataConnRef.current = null;
    }
    if (peerInstanceRef.current) {
      try {
        (peerInstanceRef.current as { destroy: () => void }).destroy();
      } catch {
        // Ignore
      }
      peerInstanceRef.current = null;
    }

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
    receivedChunkCountRef.current = 0;
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

  // Receiver handling incoming chunks & headers
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
        }
      } catch {
        // Non-json string, ignore
      }
    } else if (data instanceof ArrayBuffer) {
      const header = currentHeaderRef.current;
      if (!header) return;

      receivedChunkCountRef.current++;

      if (diskWriterRef.current) {
        await diskWriterRef.current.writeChunk(data);
      } else {
        receivedChunksRef.current.push(data);
      }

      const totalBytes =
        header.type === "file" ? header.file?.size || 0 : header.text?.length || 0;

      const currentBytes = diskWriterRef.current
        ? Math.min(totalBytes, receivedChunkCountRef.current * DEFAULT_CHUNK_SIZE)
        : receivedChunksRef.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);

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

        setProgress((prev) => ({
          ...prev,
          status: isLastInBatch ? "completed" : "transferring",
          textContent: fullText,
          progressPercentage: 100,
          speedBps: 0,
          isVerified,
        }));
      }
    }
  }, [mode]);

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
                hasAcceptedRef.current = true;
                if (acceptedResolverRef.current) {
                  acceptedResolverRef.current();
                  acceptedResolverRef.current = null;
                }
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
            .catch(() => { });
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
        import("peerjs")
          .then(({ Peer }) => {
            if (isConnectedRef.current) return;
            const peerId = `qs-${generatedCode.toLowerCase()}`;
            const peer = new Peer(peerId, {
              config: getRtcConfig(mode),
            });
            peerInstanceRef.current = peer;

            peer.on("connection", (conn) => {
              dataConnRef.current = conn;
              conn.on("open", () => {
                clearIceTimeout();
                if (conn.dataChannel) {
                  dcRef.current = conn.dataChannel;
                  setupDataChannel(conn.dataChannel, "sender");
                }
                isConnectedRef.current = true;
                setIsConnected(true);
              });

              conn.on("data", (data) => {
                handleIncomingData(data);
              });

              conn.on("close", () => {
                isConnectedRef.current = false;
                setIsConnected(false);
              });
            });

            peer.on("error", (err) => {
              console.debug("PeerJS notice (fallback active):", err.type);
            });
          })
          .catch(() => {});
      }

      // 2. Concurrently initiate HTTP signal store fallback
      signalingRef.current
        .createRoom(customCode)
        .then(({ roomId: sigRoomId, code: sigCode }) => {
          setRoomId(sigRoomId);
          setRoomCode(sigCode);
          signalingRef.current.startPolling((msg) => handleSignalMessage(msg, "sender"));
        })
        .catch(() => {});

      return { roomId: newRoomId, code: generatedCode };
    },
    [cleanup, createPeerConnection, handleSignalMessage, handleIncomingData, setupDataChannel, startIceTimeout, clearIceTimeout, mode]
  );

  // Receiver joins a session with dual PeerJS cloud broker + signaling fallback
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

      const cleanCode = normalizeRoomCode(code);
      const joinedRoomId = `room_${cleanCode}`;
      setRoomId(joinedRoomId);
      setRoomCode(cleanCode);

      // 1. Direct PeerJS WebSocket broker
      if (typeof window !== "undefined" && mode !== "hotspot") {
        import("peerjs")
          .then(({ Peer }) => {
            if (isConnectedRef.current) return;
            const peer = new Peer({
              config: getRtcConfig(mode),
            });
            peerInstanceRef.current = peer;

            peer.on("open", () => {
              const targetId = `qs-${cleanCode.toLowerCase()}`;
              const conn = peer.connect(targetId, { reliable: true });
              dataConnRef.current = conn;

              conn.on("open", () => {
                clearIceTimeout();
                if (conn.dataChannel) {
                  dcRef.current = conn.dataChannel;
                  setupDataChannel(conn.dataChannel, "receiver");
                }
                isConnectedRef.current = true;
                setIsConnected(true);
              });

              conn.on("data", (data) => {
                handleIncomingData(data);
              });

              conn.on("close", () => {
                isConnectedRef.current = false;
                setIsConnected(false);
              });
            });

            peer.on("error", (err) => {
              console.debug("PeerJS receiver notice (fallback active):", err.type);
            });
          })
          .catch(() => {});
      }

      // 2. Concurrently initiate HTTP signal store fallback
      signalingRef.current
        .joinRoom(code)
        .then(({ roomId: sigRoomId, code: sigCode }) => {
          setRoomId(sigRoomId);
          setRoomCode(sigCode);
          signalingRef.current.startPolling((msg) => handleSignalMessage(msg, "receiver"));
        })
        .catch(() => {});
    },
    [cleanup, createPeerConnection, handleSignalMessage, handleIncomingData, setupDataChannel, startIceTimeout, clearIceTimeout, mode]
  );

  // Sequential Multi-File Batch Queue Sender
  const sendFiles = useCallback(async (files: File[]) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      throw new Error("WebRTC DataChannel is not open for transfer");
    }
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
      dc.send(JSON.stringify({ type: "header", header }));

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
        while (dc.bufferedAmount > BUFFER_THRESHOLD) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }

        dc.send(chunkInfo.chunk);
        sentFileBytes += chunkInfo.chunk.byteLength;

        const progressPercent = Math.min(100, Math.round((sentFileBytes / currentFile.size) * 100));
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
  }, [mode]);

  // Text snippet sender
  const sendText = useCallback(async (text: string) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      throw new Error("WebRTC DataChannel is not open for transfer");
    }

    const header = createTextHeader(text);
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

    dc.send(JSON.stringify({ type: "header", header }));

    if (!hasAcceptedRef.current) {
      await new Promise<void>((resolve) => {
        acceptedResolverRef.current = resolve;
      });
      hasAcceptedRef.current = true;
    }

    startTimeRef.current = Date.now();
    let sentBytes = 0;

    for await (const chunkInfo of sliceBlobIntoChunks(blobToSend, DEFAULT_CHUNK_SIZE)) {
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

    const modeLabel =
      mode === "internet" ? "Via Internet" : mode === "same-network" ? "Same Wi-Fi" : "Hotspot";
    addTransferHistoryItem({
      direction: "sent",
      mode: modeLabel,
      itemType: "text",
      name: text.length > 30 ? `${text.slice(0, 30)}...` : text,
      textSnippet: text,
      size: blobToSend.size,
      status: "completed",
    });

    setProgress((prev) => ({
      ...prev,
      status: "completed",
      progressPercentage: 100,
      speedBps: 0,
    }));
  }, [mode]);

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
    const dc = dcRef.current;
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

    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "transfer-accepted" }));
    } else if (dataConnRef.current) {
      try {
        (dataConnRef.current as { send: (data: unknown) => void }).send(
          JSON.stringify({ type: "transfer-accepted" })
        );
      } catch {
        // Ignore
      }
    }
    setProgress((prev) => ({
      ...prev,
      status: "transferring",
    }));
  }, []);

  // Receiver rejects incoming payload
  const rejectIncomingTransfer = useCallback(() => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "transfer-rejected" }));
    } else if (dataConnRef.current) {
      try {
        (dataConnRef.current as { send: (data: unknown) => void }).send(
          JSON.stringify({ type: "transfer-rejected" })
        );
      } catch {
        // Ignore
      }
    }
    signalingRef.current.sendSignal("transfer-rejected").catch(() => { });
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
    sendFiles,
    sendText,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
  };
}
