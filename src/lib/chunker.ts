import type { FileMetadata, TextMetadata, TransferPayloadHeader } from "@/types/transfer";

export const DEFAULT_CHUNK_SIZE = 16 * 1024; // 16 KB safe WebRTC chunk size (prevents SCTP packet overflow)
export const MAX_CHECKSUM_FILE_SIZE = 150 * 1024 * 1024; // 150 MB threshold for real-time SHA-256

interface BatchFileOptions {
  batchId?: string;
  fileIndex?: number;
  totalFiles?: number;
  totalBatchBytes?: number;
  sha256?: string;
}

/**
 * Computes a SHA-256 hex digest for a Blob/File using Web Crypto API.
 * Returns null gracefully if Web Crypto is unavailable (e.g. non-secure contexts).
 */
export async function computeSha256(blob: Blob): Promise<string | null> {
  try {
    if (
      typeof crypto !== "undefined" &&
      crypto.subtle &&
      typeof crypto.subtle.digest === "function"
    ) {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Creates header metadata for a file transfer payload with optional batch and checksum info.
 */
export function createFileHeader(
  file: File,
  chunkSize = DEFAULT_CHUNK_SIZE,
  batchOptions?: BatchFileOptions
): TransferPayloadHeader {
  const totalChunks = Math.ceil(file.size / chunkSize) || 1;
  const metadata: FileMetadata = {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  };

  return {
    type: "file",
    file: metadata,
    totalChunks,
    chunkSize,
    ...(batchOptions || {}),
  };
}

/**
 * Creates header metadata for a text or link snippet transfer payload.
 */
export function createTextHeader(text: string, chunkSize = DEFAULT_CHUNK_SIZE): TransferPayloadHeader {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  const totalChunks = Math.ceil(encoded.byteLength / chunkSize) || 1;
  const preview = text.length > 80 ? `${text.slice(0, 80)}...` : text;

  const metadata: TextMetadata = {
    id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    preview,
    length: text.length,
  };

  return {
    type: "text",
    text: metadata,
    totalChunks,
    chunkSize,
  };
}

/**
 * Formats byte counts into human-readable strings (e.g. 1.25 MB, 450 KB).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats transfer throughput in bytes/second to MB/s or KB/s.
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "0 KB/s";
  return `${formatBytes(bytesPerSecond, 1)}/s`;
}

/**
 * Asynchronously slices a File or Blob into 64KB ArrayBuffer chunks.
 */
export async function* sliceBlobIntoChunks(
  blob: Blob,
  chunkSize = DEFAULT_CHUNK_SIZE
): AsyncGenerator<{ index: number; total: number; chunk: ArrayBuffer }> {
  const totalChunks = Math.ceil(blob.size / chunkSize) || 1;

  for (let index = 0; index < totalChunks; index++) {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, blob.size);
    const slice = blob.slice(start, end);
    const chunk = await slice.arrayBuffer();
    yield { index, total: totalChunks, chunk };
  }
}

/**
 * Reassembles an array of ArrayBuffer chunks into a single Blob.
 */
export function reassembleChunksToBlob(chunks: ArrayBuffer[], mimeType: string): Blob {
  return new Blob(chunks, { type: mimeType });
}

/**
 * Reassembles an array of ArrayBuffer chunks into a UTF-8 string.
 */
export function reassembleChunksToText(chunks: ArrayBuffer[]): string {
  const decoder = new TextDecoder("utf-8");
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") + decoder.decode();
}
