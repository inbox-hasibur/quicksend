/**
 * Optical Data Stream Protocol for Zero-Network Camera-to-Screen Transfer.
 * Streams files and text as a sequenced carousel of high-contrast QR codes
 * scanned by the opposite device's camera viewfinder.
 */

export interface OpticalDataFrame {
  transferId: string;
  chunkIndex: number; // 0-based
  totalChunks: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isCompressed: boolean;
  base64Data: string;
  encodedPayload: string;
}

export interface ReassembledPayload {
  transferId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  blob: Blob;
  text?: string;
}

export const DEFAULT_CHUNK_RAW_BYTES = 66; // Produces ~88 base64 characters (<= 90 chars max payload), keeping QR modules large and easily scannable on standard webcams

/**
 * Encodes an ArrayBuffer or Blob into sequenced optical QR frames.
 */
export async function encodeFileToOpticalFrames(
  file: File,
  chunkSize = DEFAULT_CHUNK_RAW_BYTES
): Promise<OpticalDataFrame[]> {
  const transferId = `opt_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).substring(2, 5)}`;
  const buffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(buffer);

  // Compress if CompressionStream is available
  let dataBytes = rawBytes;
  let isCompressed = false;

  if (typeof CompressionStream !== "undefined" && rawBytes.length > 256) {
    try {
      const stream = new Blob([rawBytes]).stream().pipeThrough(new CompressionStream("deflate"));
      const compressedBuffer = await new Response(stream).arrayBuffer();
      const compressedBytes = new Uint8Array(compressedBuffer);
      if (compressedBytes.length < rawBytes.length) {
        dataBytes = compressedBytes;
        isCompressed = true;
      }
    } catch {
      // Fallback to uncompressed
      dataBytes = rawBytes;
      isCompressed = false;
    }
  }

  const totalChunks = Math.max(1, Math.ceil(dataBytes.length / chunkSize));
  const frames: OpticalDataFrame[] = [];

  // Safe file name escaping for pipe delimiter
  const safeFileName = encodeURIComponent(file.name || "payload.bin");
  const safeMime = encodeURIComponent(file.type || "application/octet-stream");

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, dataBytes.length);
    const slice = dataBytes.slice(start, end);

    // Convert slice to base64
    let binary = "";
    for (let b = 0; b < slice.length; b++) {
      binary += String.fromCharCode(slice[b]);
    }
    const base64Data = btoa(binary);

    // Protocol format: QS1|<transferId>|<index>|<total>|<fileName>|<fileSize>|<mimeType>|<isCompressed>|<base64>
    const encodedPayload = `QS1|${transferId}|${i}|${totalChunks}|${safeFileName}|${file.size}|${safeMime}|${isCompressed ? 1 : 0}|${base64Data}`;

    frames.push({
      transferId,
      chunkIndex: i,
      totalChunks,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      isCompressed,
      base64Data,
      encodedPayload,
    });
  }

  return frames;
}

/**
 * Encodes plain text snippet into optical QR frames.
 */
export async function encodeTextToOpticalFrames(
  text: string,
  chunkSize = DEFAULT_CHUNK_RAW_BYTES
): Promise<OpticalDataFrame[]> {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const file = new File([blob], "message.txt", { type: "text/plain" });
  return encodeFileToOpticalFrames(file, chunkSize);
}

/**
 * Validates whether a scanned QR string matches the QuickSend optical data frame signature.
 */
export function isOpticalDataFrame(payload: string): boolean {
  return typeof payload === "string" && payload.startsWith("QS1|");
}

/**
 * Parses an incoming optical data frame string.
 */
export function parseOpticalDataFrame(raw: string): OpticalDataFrame | null {
  if (!isOpticalDataFrame(raw)) return null;

  const parts = raw.split("|");
  if (parts.length < 9) return null;

  const [, transferId, idxStr, totalStr, rawName, sizeStr, rawMime, compStr, base64Data] = parts;
  const chunkIndex = parseInt(idxStr, 10);
  const totalChunks = parseInt(totalStr, 10);
  const fileSize = parseInt(sizeStr, 10);
  const isCompressed = compStr === "1";

  if (isNaN(chunkIndex) || isNaN(totalChunks) || isNaN(fileSize)) {
    return null;
  }

  let fileName = "payload.bin";
  let mimeType = "application/octet-stream";
  try {
    fileName = decodeURIComponent(rawName);
    mimeType = decodeURIComponent(rawMime);
  } catch {
    // Keep defaults
  }

  return {
    transferId,
    chunkIndex,
    totalChunks,
    fileName,
    fileSize,
    mimeType,
    isCompressed,
    base64Data,
    encodedPayload: raw,
  };
}

/**
 * Reactive collector that reassembles frames in any order and triggers completion callback.
 */
export class OpticalDataCollector {
  private transferId: string | null = null;
  private totalChunks: number = 0;
  private fileName: string = "";
  private fileSize: number = 0;
  private mimeType: string = "";
  private isCompressed: boolean = false;
  private chunks: Map<number, Uint8Array> = new Map();

  /**
   * Ingests a scanned frame string.
   * Returns:
   * - `status: 'collecting'` with current progress
   * - `status: 'completed'` with the reassembled payload
   * - `status: 'invalid'` if frame doesn't match current transfer or is corrupt
   */
  async ingestFrame(
    raw: string
  ): Promise<
    | { status: "invalid" }
    | {
        status: "collecting";
        transferId: string;
        fileName: string;
        fileSize: number;
        totalChunks: number;
        receivedCount: number;
        percentage: number;
        missingIndices: number[];
      }
    | {
        status: "completed";
        payload: ReassembledPayload;
      }
  > {
    const frame = parseOpticalDataFrame(raw);
    if (!frame) return { status: "invalid" };

    // If new transfer encountered, reset collector
    if (!this.transferId || this.transferId !== frame.transferId) {
      this.reset();
      this.transferId = frame.transferId;
      this.totalChunks = frame.totalChunks;
      this.fileName = frame.fileName;
      this.fileSize = frame.fileSize;
      this.mimeType = frame.mimeType;
      this.isCompressed = frame.isCompressed;
    }

    // Decode base64 to binary
    if (!this.chunks.has(frame.chunkIndex)) {
      try {
        const binary = atob(frame.base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        this.chunks.set(frame.chunkIndex, bytes);
      } catch {
        return { status: "invalid" };
      }
    }

    const receivedCount = this.chunks.size;
    const percentage = Math.min(100, Math.round((receivedCount / this.totalChunks) * 100));

    // Calculate missing chunk indices
    const missingIndices: number[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.chunks.has(i)) {
        missingIndices.push(i);
      }
    }

    // Check if fully received
    if (this.chunks.size === this.totalChunks) {
      const payload = await this.reassemble();
      return { status: "completed", payload };
    }

    return {
      status: "collecting",
      transferId: this.transferId,
      fileName: this.fileName,
      fileSize: this.fileSize,
      totalChunks: this.totalChunks,
      receivedCount,
      percentage,
      missingIndices,
    };
  }

  private async reassemble(): Promise<ReassembledPayload> {
    // Calculate total buffer length
    let totalLen = 0;
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.chunks.get(i);
      if (chunk) totalLen += chunk.length;
    }

    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.chunks.get(i);
      if (chunk) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
    }

    let finalBytes = merged;

    // Decompress if compressed
    if (this.isCompressed && typeof DecompressionStream !== "undefined") {
      try {
        const stream = new Blob([merged]).stream().pipeThrough(new DecompressionStream("deflate"));
        const decompressedBuffer = await new Response(stream).arrayBuffer();
        finalBytes = new Uint8Array(decompressedBuffer);
      } catch {
        finalBytes = merged;
      }
    }

    const blob = new Blob([finalBytes as BlobPart], { type: this.mimeType });
    let text: string | undefined = undefined;
    if (this.mimeType.startsWith("text/")) {
      try {
        text = new TextDecoder().decode(finalBytes);
      } catch {
        // Keep undefined
      }
    }

    return {
      transferId: this.transferId || "unknown",
      fileName: this.fileName || "downloaded-file",
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      blob,
      text,
    };
  }

  reset(): void {
    this.transferId = null;
    this.totalChunks = 0;
    this.fileName = "";
    this.fileSize = 0;
    this.mimeType = "";
    this.isCompressed = false;
    this.chunks.clear();
  }

  getProgress() {
    return {
      totalChunks: this.totalChunks,
      receivedCount: this.chunks.size,
      percentage: this.totalChunks > 0 ? Math.round((this.chunks.size / this.totalChunks) * 100) : 0,
    };
  }
}
