import {
  sliceBlobIntoChunks,
  reassembleChunksToBlob,
  reassembleChunksToText,
  computeSha256,
  MAX_CHECKSUM_FILE_SIZE,
} from "@/lib/chunker";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import type { TransferMode } from "@/types/mode";
import type { TransferPayloadHeader } from "@/types/transfer";
import type { DiskStreamWriter } from "@/lib/diskStream";
import type { DrainableChannel } from "./types";

/**
 * Wait for a DataChannel buffer to drain below threshold.
 * Resolves immediately if already below or equal to threshold.
 * Otherwise sets threshold, listens for "bufferedamountlow", and includes a 5s safety timeout.
 */
export async function waitForDrain(
  channel: DrainableChannel | null | undefined,
  threshold: number,
  timeoutMs = 5000
): Promise<void> {
  if (!channel) return;
  // Never wait if buffer is already at or below threshold
  if (channel.bufferedAmount <= threshold) {
    return;
  }

  // Set threshold before awaiting drain
  if (typeof channel.bufferedAmountLowThreshold === "number" || "bufferedAmountLowThreshold" in channel) {
    channel.bufferedAmountLowThreshold = threshold;
  }

  // Re-check in case buffer drained before event listener attachment
  if (channel.bufferedAmount <= threshold) {
    return;
  }

  return new Promise<void>((resolve) => {
    let timer: NodeJS.Timeout | null = null;

    const cleanupAndResolve = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (typeof channel.removeEventListener === "function") {
        channel.removeEventListener("bufferedamountlow", onLow);
      } else if (channel.onbufferedamountlow === onLow) {
        channel.onbufferedamountlow = null;
      }
      resolve();
    };

    const onLow = () => {
      cleanupAndResolve();
    };

    if (typeof channel.addEventListener === "function") {
      channel.addEventListener("bufferedamountlow", onLow, { once: true });
    } else {
      channel.onbufferedamountlow = onLow;
    }

    // Safety timeout so lost events cannot freeze transfer
    timer = setTimeout(() => {
      cleanupAndResolve();
    }, timeoutMs);
  });
}

/**
 * Wait for DataChannel to reach readyState 'open' with timeout.
 */
export async function waitForChannelOpen(
  isOpenFn: () => boolean,
  timeoutMs = 10000
): Promise<boolean> {
  if (isOpenFn()) return true;

  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (isOpenFn()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 50);
  });
}

/**
 * Normalizes binary data received from DataChannel (ArrayBuffer, TypedArray view, or Blob) into an ArrayBuffer.
 */
export async function normalizeChunkBuffer(data: unknown): Promise<ArrayBuffer | null> {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return await data.arrayBuffer();
  }
  return null;
}

/**
 * Programmatically triggers a file download via an anchor click.
 */
export function triggerBlobDownload(url: string, filename: string): void {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    // Silently ignore programmatic click blocks on mobile browsers
  }
}

export interface StreamChunkCallbacks {
  onChunkSent: (sentBytes: number, totalBytes: number, speedBps: number) => void;
  waitForDrain: () => Promise<void>;
  sendRawData: (chunk: ArrayBuffer) => void;
}

/**
 * Slices a blob into chunks and sends them sequentially respecting backpressure.
 */
export async function streamBlobChunks(
  blob: Blob,
  chunkSize: number,
  callbacks: StreamChunkCallbacks
): Promise<number> {
  const startTime = Date.now();
  let sentBytes = 0;

  for await (const chunkInfo of sliceBlobIntoChunks(blob, chunkSize)) {
    await callbacks.waitForDrain();
    callbacks.sendRawData(chunkInfo.chunk);
    sentBytes += chunkInfo.chunk.byteLength;

    const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
    const speed = Math.round(sentBytes / elapsedSec);
    callbacks.onChunkSent(sentBytes, blob.size, speed);
  }

  return sentBytes;
}

export interface FinalizePayloadParams {
  header: TransferPayloadHeader;
  receivedChunks: ArrayBuffer[];
  diskWriter: DiskStreamWriter | null;
  mode: TransferMode;
}

export interface FinalizePayloadResult {
  fullText?: string;
  downloadUrl?: string;
  isVerified: boolean;
}

/**
 * Finalizes reassembly of received chunks (file blob or text), verifies checksum,
 * triggers download, and records transfer history.
 */
export async function finalizeReceivedPayload({
  header,
  receivedChunks,
  diskWriter,
  mode,
}: FinalizePayloadParams): Promise<FinalizePayloadResult> {
  let isVerified = false;
  let downloadUrl: string | undefined;

  if (diskWriter) {
    await diskWriter.close();
    isVerified = true;
  } else if (header.type === "file" && header.file) {
    const blob = reassembleChunksToBlob(receivedChunks, header.file.type);

    if (header.sha256 && header.file.size <= MAX_CHECKSUM_FILE_SIZE) {
      const computedHash = await computeSha256(blob);
      isVerified = computedHash === header.sha256;
    } else {
      isVerified = Boolean(header.sha256);
    }

    downloadUrl = URL.createObjectURL(blob);
    triggerBlobDownload(downloadUrl, header.file.name);
  }

  let fullText: string | undefined;
  if (header.type === "text") {
    fullText = reassembleChunksToText(receivedChunks);
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

  return { fullText, downloadUrl, isVerified };
}
