"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { encodeOpticalSdp, decodeOpticalSdp } from "@/lib/opticalSdp";
import {
  DEFAULT_CHUNK_SIZE,
  MAX_CHECKSUM_FILE_SIZE,
  createFileHeader,
  createTextHeader,
  computeSha256,
} from "@/lib/chunker";
import {
  waitForDrain,
  normalizeChunkBuffer,
  streamBlobChunks,
  finalizeReceivedPayload,
} from "@/lib/webrtc/backpressure";
import {
  createDiskStreamWriter,
  DISK_STREAM_THRESHOLD,
  type DiskStreamWriter,
} from "@/lib/diskStream";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import type { TransferPayloadHeader, TransferProgressState } from "@/types/transfer";

export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 1800): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const end = () => { if (!done) { done = true; cleanup(); resolve(); } };
    const timer = setTimeout(end, timeoutMs);
    const onState = () => { if (pc.iceGatheringState === "complete") end(); };
    const onCand = (e: RTCPeerConnectionIceEvent) => { if (!e.candidate) end(); };
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onState);
      pc.removeEventListener("icecandidate", onCand);
    };
    pc.addEventListener("icegatheringstatechange", onState);
    pc.addEventListener("icecandidate", onCand);
  });
}

const applyCandidates = (pc: RTCPeerConnection, list: RTCIceCandidateInit[]) =>
  Promise.all(list.map((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})));

const initialProgress: TransferProgressState = {
  status: "idle", itemType: "file", bytesTransferred: 0, totalBytes: 0, progressPercentage: 0, speedBps: 0,
};

export function useOfflineHotspotRTC() {
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<TransferProgressState>(initialProgress);
  const [pendingHeader, setPendingHeader] = useState<TransferPayloadHeader | null>(null);
  const [localQrPayload, setLocalQrPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pendingHeaderRef = useRef<TransferPayloadHeader | null>(null);
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const diskWriterRef = useRef<DiskStreamWriter | null>(null);
  const acceptedResolverRef = useRef<(() => void) | null>(null);
  const acceptedRejecterRef = useRef<(() => void) | null>(null);
  const activeDownloadUrlsRef = useRef<string[]>([]);
  const receivedBytesRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    acceptedRejecterRef.current?.();
    acceptedResolverRef.current = null;
    acceptedRejecterRef.current = null;
    if (diskWriterRef.current) { diskWriterRef.current.abort().catch(() => {}); diskWriterRef.current = null; }
    for (const url of activeDownloadUrlsRef.current) try { URL.revokeObjectURL(url); } catch {}
    activeDownloadUrlsRef.current = [];
    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    pendingHeaderRef.current = null;
    receivedChunksRef.current = [];
    receivedBytesRef.current = 0;
    setIsConnected(false);
    setProgress(initialProgress);
    setPendingHeader(null);
    setLocalQrPayload(null);
    setError(null);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc;
    dc.binaryType = "arraybuffer";
    dc.onopen = () => { setIsConnected(true); setError(null); };
    dc.onclose = () => setIsConnected(false);
    dc.onerror = () => { setIsConnected(false); setError("DataChannel connection failed"); };

    dc.onmessage = async (e) => {
      if (typeof e.data === "string") {
        if (e.data === "ACCEPT") { acceptedResolverRef.current?.(); acceptedResolverRef.current = null; acceptedRejecterRef.current = null; return; }
        if (e.data === "REJECT") { acceptedRejecterRef.current?.(); acceptedResolverRef.current = null; acceptedRejecterRef.current = null; setProgress((p) => ({ ...p, status: "rejected" })); return; }
        try {
          const h: TransferPayloadHeader = JSON.parse(e.data);
          pendingHeaderRef.current = h;
          setPendingHeader(h);
          receivedChunksRef.current = [];
          receivedBytesRef.current = 0;
          startTimeRef.current = Date.now();
          setProgress({ status: "waiting-acceptance", itemType: h.type, fileName: h.file?.name, fileSize: h.file?.size, textPreview: h.text?.preview, bytesTransferred: 0, totalBytes: h.file?.size || h.text?.length || 0, progressPercentage: 0, speedBps: 0, fileIndex: h.fileIndex, totalFiles: h.totalFiles, batchId: h.batchId, sha256: h.sha256 });
        } catch {}
        return;
      }

      const chunk = await normalizeChunkBuffer(e.data);
      if (!chunk || !pendingHeaderRef.current) return;
      const h = pendingHeaderRef.current;
      const total = h.file?.size || h.text?.length || 0;
      if (diskWriterRef.current) await diskWriterRef.current.writeChunk(chunk);
      else receivedChunksRef.current.push(chunk);

      receivedBytesRef.current += chunk.byteLength;
      const rec = receivedBytesRef.current;
      const elapsed = (Date.now() - startTimeRef.current) / 1000 || 0.1;
      setProgress((p) => ({ ...p, status: "transferring", bytesTransferred: rec, progressPercentage: total > 0 ? Math.min(100, Math.round((rec / total) * 100)) : 100, speedBps: Math.round(rec / elapsed) }));

      if (rec >= total && total > 0) {
        const { fullText, downloadUrl, isVerified } = await finalizeReceivedPayload({ header: h, receivedChunks: receivedChunksRef.current, diskWriter: diskWriterRef.current, mode: "hotspot" });
        if (downloadUrl) activeDownloadUrlsRef.current.push(downloadUrl);
        diskWriterRef.current = null;
        pendingHeaderRef.current = null;
        setPendingHeader(null);
        setProgress((p) => ({ ...p, status: "completed", bytesTransferred: total, progressPercentage: 100, textContent: fullText, downloadUrl, isVerified }));
      }
    };
  }, []);

  const bindPc = useCallback((pc: RTCPeerConnection) => {
    pcRef.current = pc;
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") setIsConnected(false);
    };
  }, []);

  const createOfflineOffer = useCallback(async (): Promise<string> => {
    cleanup();
    const pc = new RTCPeerConnection({ iceServers: [] });
    bindPc(pc);
    const dc = pc.createDataChannel("hotspot-offline", { ordered: true });
    setupDataChannel(dc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc, 1800);
    const qr = encodeOpticalSdp(pc.localDescription || offer);
    setLocalQrPayload(qr);
    return qr;
  }, [cleanup, bindPc, setupDataChannel]);

  const completeOfflineAnswer = useCallback(async (rawAnswerQr: string): Promise<void> => {
    const pc = pcRef.current;
    if (!pc) throw new Error("No active PeerConnection for answer");
    const { desc, candidates } = decodeOpticalSdp(rawAnswerQr);
    await pc.setRemoteDescription(new RTCSessionDescription(desc));
    await applyCandidates(pc, candidates);
  }, []);

  const acceptOfflineOffer = useCallback(async (rawOfferQr: string): Promise<string> => {
    cleanup();
    const { desc, candidates } = decodeOpticalSdp(rawOfferQr);
    const pc = new RTCPeerConnection({ iceServers: [] });
    bindPc(pc);
    pc.ondatachannel = (e) => setupDataChannel(e.channel);
    await pc.setRemoteDescription(new RTCSessionDescription(desc));
    await applyCandidates(pc, candidates);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc, 1800);
    const qr = encodeOpticalSdp(pc.localDescription || answer);
    setLocalQrPayload(qr);
    return qr;
  }, [cleanup, bindPc, setupDataChannel]);

  const acceptIncomingTransfer = useCallback(async () => {
    const dc = dcRef.current;
    const header = pendingHeaderRef.current;
    if (!dc || !header) return;
    if (header.type === "file" && header.file && header.file.size > DISK_STREAM_THRESHOLD) {
      diskWriterRef.current = await createDiskStreamWriter(header.file.name);
    }
    receivedBytesRef.current = 0;
    startTimeRef.current = Date.now();
    dc.send("ACCEPT");
    setProgress((p) => ({ ...p, status: "transferring" }));
  }, []);

  const rejectIncomingTransfer = useCallback(() => {
    if (dcRef.current) try { dcRef.current.send("REJECT"); } catch {}
    pendingHeaderRef.current = null;
    setPendingHeader(null);
    setProgress((p) => ({ ...p, status: "rejected" }));
  }, []);

  const waitAccept = () => new Promise<boolean>((res) => { acceptedResolverRef.current = () => res(true); acceptedRejecterRef.current = () => res(false); });

  const sendFiles = useCallback(async (files: File[]): Promise<void> => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") throw new Error("DataChannel is not open");
    if (files.length === 0) return;
    const totalBatchBytes = files.reduce((acc, f) => acc + f.size, 0);
    const batchId = `batch_${Date.now()}`;
    let batchTransferred = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sha256 = file.size <= MAX_CHECKSUM_FILE_SIZE ? ((await computeSha256(file)) || undefined) : undefined;
      const h = createFileHeader(file, DEFAULT_CHUNK_SIZE, { batchId, fileIndex: i + 1, totalFiles: files.length, totalBatchBytes, sha256 });
      dc.send(JSON.stringify(h));
      setProgress({ status: "waiting-acceptance", itemType: "file", fileName: file.name, fileSize: file.size, bytesTransferred: 0, totalBytes: file.size, progressPercentage: 0, speedBps: 0, fileIndex: i + 1, totalFiles: files.length, batchId, totalBatchBytes, batchBytesTransferred: batchTransferred, sha256 });

      if (!(await waitAccept())) { setProgress((p) => ({ ...p, status: "rejected" })); return; }
      setProgress((p) => ({ ...p, status: "transferring" }));

      await streamBlobChunks(file, DEFAULT_CHUNK_SIZE, {
        onChunkSent: (s, tot, spd) => setProgress((p) => ({ ...p, bytesTransferred: s, progressPercentage: Math.round((s / tot) * 100), speedBps: spd, batchBytesTransferred: batchTransferred + s })),
        waitForDrain: () => waitForDrain(dc, 64 * 1024),
        sendRawData: (chk) => dc.send(chk),
      });
      batchTransferred += file.size;
      addTransferHistoryItem({ direction: "sent", mode: "Hotspot", itemType: "file", name: file.name, size: file.size, status: "completed" });
    }
    setProgress((p) => ({ ...p, status: "completed", progressPercentage: 100, bytesTransferred: p.totalBytes }));
  }, []);

  const sendText = useCallback(async (text: string): Promise<void> => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") throw new Error("DataChannel is not open");
    if (!text) return;
    const h = createTextHeader(text, DEFAULT_CHUNK_SIZE);
    dc.send(JSON.stringify(h));
    const total = new Blob([text]).size;
    setProgress({ status: "waiting-acceptance", itemType: "text", textPreview: h.text?.preview, bytesTransferred: 0, totalBytes: total, progressPercentage: 0, speedBps: 0 });

    if (!(await waitAccept())) { setProgress((p) => ({ ...p, status: "rejected" })); return; }
    setProgress((p) => ({ ...p, status: "transferring" }));

    await streamBlobChunks(new Blob([text], { type: "text/plain" }), DEFAULT_CHUNK_SIZE, {
      onChunkSent: (s, tot, spd) => setProgress((p) => ({ ...p, bytesTransferred: s, progressPercentage: Math.round((s / tot) * 100), speedBps: spd })),
      waitForDrain: () => waitForDrain(dc, 64 * 1024),
      sendRawData: (chk) => dc.send(chk),
    });
    addTransferHistoryItem({ direction: "sent", mode: "Hotspot", itemType: "text", name: text.length > 30 ? `${text.slice(0, 30)}...` : text, textSnippet: text, size: total, status: "completed" });
    setProgress((p) => ({ ...p, status: "completed", progressPercentage: 100, bytesTransferred: total }));
  }, []);

  return {
    isConnected, progress, pendingHeader, localQrPayload, error,
    createOfflineOffer, completeOfflineAnswer, acceptOfflineOffer,
    sendFiles, sendText, acceptIncomingTransfer, rejectIncomingTransfer, cleanup,
  };
}
