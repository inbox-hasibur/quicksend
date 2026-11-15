/**
 * Optical Data Stream Protocol for Zero-Network Camera-to-Screen Transfer.
 * Streams files and text as a sequenced carousel of high-contrast QR codes
 * scanned by the opposite device's camera viewfinder.
 * Includes XOR parity frames for automatic packet recovery and typed recovery codes.
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
  hash?: string;
  isParity?: boolean;
  parityGroup?: number;
  totalParityGroups?: number;
}

export interface ReassembledPayload {
  transferId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  blob: Blob;
  text?: string;
  hash?: string;
  hashVerified?: boolean;
}

export const OPTICAL_CHUNK_PRESETS = {
  small: 66,
  medium: 150,
  large: 300,
} as const;

export type OpticalChunkPreset = keyof typeof OPTICAL_CHUNK_PRESETS;

export const DEFAULT_CHUNK_RAW_BYTES = OPTICAL_CHUNK_PRESETS.medium; // 150 bytes default

/**
 * Fast 32-bit FNV-1a payload checksum formatted as 8-character hex.
 */
export function computePayloadHash(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

/**
 * Encodes an ArrayBuffer or Blob into sequenced optical QR frames.
 */
export async function encodeFileToOpticalFrames(
  file: File,
  chunkSize: number = DEFAULT_CHUNK_RAW_BYTES
): Promise<OpticalDataFrame[]> {
  const transferId = `opt_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).substring(2, 5)}`;
  const buffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(buffer);
  const hash = computePayloadHash(rawBytes);

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

    const base64Data = bytesToBase64(slice);

    // Protocol format: QS1|<transferId>|<index>|<total>|<fileName>|<fileSize>|<mimeType>|<isCompressed>|<base64>|<hash>
    const encodedPayload = `QS1|${transferId}|${i}|${totalChunks}|${safeFileName}|${file.size}|${safeMime}|${isCompressed ? 1 : 0}|${base64Data}|${hash}`;

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
      hash,
      isParity: false,
    });
  }

  return frames;
}

/**
 * Encodes plain text snippet into optical QR frames.
 */
export async function encodeTextToOpticalFrames(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_RAW_BYTES
): Promise<OpticalDataFrame[]> {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const file = new File([blob], "message.txt", { type: "text/plain" });
  return encodeFileToOpticalFrames(file, chunkSize);
}

/**
 * Builds XOR parity frames across data frames using stride grouping (i % S).
 * S = ceil(K / 10). Each group g carries the XOR of all zero-padded chunks in group g.
 */
export function buildParityFrames(
  dataFrames: OpticalDataFrame[],
  chunkSize: number = DEFAULT_CHUNK_RAW_BYTES
): OpticalDataFrame[] {
  const K = dataFrames.length;
  if (K === 0) return [];

  const S = Math.ceil(K / 10);
  const sessionHash = dataFrames[0]?.hash || computePayloadHash(new Uint8Array(0));
  const parityFrames: OpticalDataFrame[] = [];

  const lastChunkBytes = base64ToBytes(dataFrames[K - 1].base64Data);
  const lastChunkLen = lastChunkBytes.length;
  const lastChunkGroup = (K - 1) % S;
  const hasShortFinalChunk = lastChunkLen < chunkSize;

  for (let g = 0; g < S; g++) {
    const groupFrames = dataFrames.filter((_, idx) => idx % S === g);
    const xorBuffer = new Uint8Array(chunkSize);

    for (const df of groupFrames) {
      const bytes = base64ToBytes(df.base64Data);
      for (let b = 0; b < bytes.length; b++) {
        xorBuffer[b] ^= bytes[b];
      }
    }

    const base64Xor = bytesToBase64(xorBuffer);
    const isLastGroup = g === lastChunkGroup && hasShortFinalChunk;
    const encodedPayload = isLastGroup
      ? `QP1|${g}/${S}|${sessionHash}|${base64Xor}|${lastChunkLen}`
      : `QP1|${g}/${S}|${sessionHash}|${base64Xor}`;

    parityFrames.push({
      transferId: dataFrames[0]?.transferId || "parity",
      chunkIndex: K + g,
      totalChunks: K + S,
      fileName: dataFrames[0]?.fileName || "parity",
      fileSize: dataFrames[0]?.fileSize || 0,
      mimeType: "application/x-parity",
      isCompressed: false,
      base64Data: base64Xor,
      encodedPayload,
      hash: sessionHash,
      isParity: true,
      parityGroup: g,
      totalParityGroups: S,
    });
  }

  return parityFrames;
}

/**
 * Calculates total frames including data and parity frames: K + ceil(K / 10).
 */
export function getTotalFrameCount(dataFrameCount: number): number {
  if (dataFrameCount <= 0) return 0;
  return dataFrameCount + Math.ceil(dataFrameCount / 10);
}

export const totalFrameCount = getTotalFrameCount;

/**
 * Validates whether a scanned QR string matches the QuickSend optical data frame signature.
 */
export function isOpticalDataFrame(payload: string): boolean {
  return typeof payload === "string" && (payload.startsWith("QS1|") || payload.startsWith("QP1|"));
}

/**
 * Parses an incoming optical data frame string.
 */
export function parseOpticalDataFrame(raw: string): OpticalDataFrame | null {
  try {
    if (!raw || typeof raw !== "string" || !raw.startsWith("QS1|")) return null;

    const parts = raw.split("|");
    if (parts.length < 9) return null;

    const [, transferId, idxStr, totalStr, rawName, sizeStr, rawMime, compStr, base64Data, frameHash] = parts;
    const chunkIndex = parseInt(idxStr, 10);
    const totalChunks = parseInt(totalStr, 10);
    const fileSize = parseInt(sizeStr, 10);
    const isCompressed = compStr === "1";

    if (
      isNaN(chunkIndex) ||
      isNaN(totalChunks) ||
      isNaN(fileSize) ||
      chunkIndex < 0 ||
      totalChunks <= 0 ||
      chunkIndex >= totalChunks ||
      fileSize < 0 ||
      !transferId ||
      !base64Data
    ) {
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
      hash: frameHash || undefined,
      isParity: false,
    };
  } catch {
    return null;
  }
}

export interface ParsedParityFrame {
  group: number;
  totalGroups: number;
  sessionHash: string;
  xorBytes: Uint8Array;
  lastChunkLen?: number;
}

/**
 * Parses an incoming optical parity frame (QP1|<g>/<S>|<sessionHash>|<base64 xor>[|<lastChunkLen>]).
 */
export function parseOpticalParityFrame(raw: string): ParsedParityFrame | null {
  try {
    if (!raw || typeof raw !== "string" || !raw.startsWith("QP1|")) return null;
    const parts = raw.split("|");
    if (parts.length < 4) return null;

    const groupParts = parts[1].split("/");
    if (groupParts.length !== 2) return null;
    const group = parseInt(groupParts[0], 10);
    const totalGroups = parseInt(groupParts[1], 10);
    const sessionHash = parts[2];
    const base64Data = parts[3];

    if (
      isNaN(group) ||
      isNaN(totalGroups) ||
      group < 0 ||
      totalGroups <= 0 ||
      group >= totalGroups ||
      !sessionHash ||
      !base64Data
    ) {
      return null;
    }

    let lastChunkLen: number | undefined = undefined;
    if (parts.length >= 5 && parts[4]) {
      const len = parseInt(parts[4], 10);
      if (!isNaN(len) && len >= 0) {
        lastChunkLen = len;
      }
    }

    const xorBytes = base64ToBytes(base64Data);
    return {
      group,
      totalGroups,
      sessionHash,
      xorBytes,
      lastChunkLen,
    };
  } catch {
    return null;
  }
}

export type IngestResult =
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
  | {
      status: "error";
      error: string;
    };

/**
 * Reactive collector that reassembles frames in any order and triggers completion callback.
 * Automatically recovers missing data chunks using XOR parity frames.
 */
export class OpticalDataCollector {
  private transferId: string | null = null;
  private totalChunks: number = 0; // K data chunks
  private fileName: string = "";
  private fileSize: number = 0;
  private mimeType: string = "";
  private isCompressed: boolean = false;
  private expectedHash: string | null = null;
  private completedPayload: ReassembledPayload | null = null;
  private chunks: Map<number, Uint8Array> = new Map();
  private parityGroups: Map<number, ParsedParityFrame> = new Map();

  async add(raw: string): Promise<IngestResult> {
    return this.ingestFrame(raw);
  }

  async ingestFrame(raw: string): Promise<IngestResult> {
    if (!raw || typeof raw !== "string") return { status: "invalid" };

    if (raw.startsWith("QP1|")) {
      return this.ingestParityFrame(raw);
    }

    if (raw.startsWith("QS1|")) {
      return this.ingestDataFrame(raw);
    }

    return { status: "invalid" };
  }

  private async ingestParityFrame(raw: string): Promise<IngestResult> {
    const parity = parseOpticalParityFrame(raw);
    if (!parity) return { status: "invalid" };

    if (this.expectedHash && this.expectedHash !== parity.sessionHash) {
      this.reset();
    }
    this.expectedHash = parity.sessionHash;
    this.parityGroups.set(parity.group, parity);

    if (this.completedPayload) {
      return { status: "completed", payload: this.completedPayload };
    }

    if (this.totalChunks > 0) {
      this.tryRecover();
      if (this.chunks.size === this.totalChunks) {
        return await this.reassemble();
      }
    }

    const receivedCount = this.chunks.size;
    const percentage =
      this.totalChunks > 0
        ? Math.min(100, Math.round((receivedCount / this.totalChunks) * 100))
        : 0;

    return {
      status: "collecting",
      transferId: this.transferId || "",
      fileName: this.fileName,
      fileSize: this.fileSize,
      totalChunks: this.totalChunks,
      receivedCount,
      percentage,
      missingIndices: this.getMissingIndices(),
    };
  }

  private async ingestDataFrame(raw: string): Promise<IngestResult> {
    const frame = parseOpticalDataFrame(raw);
    if (!frame) return { status: "invalid" };

    // Reset collector if new session id or total chunks change
    if (
      !this.transferId ||
      this.transferId !== frame.transferId ||
      this.totalChunks !== frame.totalChunks
    ) {
      this.reset();
      this.transferId = frame.transferId;
      this.totalChunks = frame.totalChunks;
      this.fileName = frame.fileName;
      this.fileSize = frame.fileSize;
      this.mimeType = frame.mimeType;
      this.isCompressed = frame.isCompressed;
      this.expectedHash = frame.hash || null;
    }

    if (frame.hash && !this.expectedHash) {
      this.expectedHash = frame.hash;
    }

    // Return cached payload if already completed
    if (this.completedPayload) {
      return { status: "completed", payload: this.completedPayload };
    }

    // Decode base64 to binary
    if (!this.chunks.has(frame.chunkIndex)) {
      try {
        const bytes = base64ToBytes(frame.base64Data);
        this.chunks.set(frame.chunkIndex, bytes);
      } catch {
        return { status: "invalid" };
      }
    }

    // Attempt parity recovery for any group with 1 missing chunk
    this.tryRecover();

    if (this.chunks.size === this.totalChunks) {
      return await this.reassemble();
    }

    const receivedCount = this.chunks.size;
    const percentage = Math.min(100, Math.round((receivedCount / this.totalChunks) * 100));

    return {
      status: "collecting",
      transferId: this.transferId,
      fileName: this.fileName,
      fileSize: this.fileSize,
      totalChunks: this.totalChunks,
      receivedCount,
      percentage,
      missingIndices: this.getMissingIndices(),
    };
  }

  /**
   * Attempts automatic XOR recovery across parity groups with exactly 1 missing chunk.
   */
  private tryRecover(): boolean {
    if (this.totalChunks <= 0 || this.parityGroups.size === 0) {
      return false;
    }

    const K = this.totalChunks;
    const S = Math.ceil(K / 10);
    let recoveredAny = false;

    for (let g = 0; g < S; g++) {
      const parity = this.parityGroups.get(g);
      if (!parity) continue;

      const groupIndices: number[] = [];
      for (let i = g; i < K; i += S) {
        groupIndices.push(i);
      }

      const missingInGroup = groupIndices.filter((idx) => !this.chunks.has(idx));

      if (missingInGroup.length === 1) {
        const missingIdx = missingInGroup[0];
        const recovered = new Uint8Array(parity.xorBytes);

        for (const presentIdx of groupIndices) {
          if (presentIdx !== missingIdx) {
            const chunkBytes = this.chunks.get(presentIdx)!;
            for (let b = 0; b < chunkBytes.length; b++) {
              recovered[b] ^= chunkBytes[b];
            }
          }
        }

        let finalChunkBytes = recovered;
        if (missingIdx === K - 1 && parity.lastChunkLen !== undefined) {
          finalChunkBytes = recovered.slice(0, parity.lastChunkLen);
        }

        this.chunks.set(missingIdx, finalChunkBytes);
        recoveredAny = true;
      }
    }

    return recoveredAny;
  }

  getMissingIndices(): number[] {
    const missing: number[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.chunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  getSessionHash(): string | null {
    return this.expectedHash;
  }

  private async reassemble(): Promise<
    | { status: "completed"; payload: ReassembledPayload }
    | { status: "error"; error: string }
  > {
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
    if (this.isCompressed) {
      if (typeof DecompressionStream !== "undefined") {
        try {
          const stream = new Blob([merged]).stream().pipeThrough(new DecompressionStream("deflate"));
          const decompressedBuffer = await new Response(stream).arrayBuffer();
          finalBytes = new Uint8Array(decompressedBuffer);
        } catch {
          return { status: "error", error: "Decompression failed: stream corrupted" };
        }
      } else {
        return { status: "error", error: "Decompression not supported in this environment" };
      }
    }

    // Verify hash integrity
    const calculatedHash = computePayloadHash(finalBytes);
    let hashVerified = false;
    if (this.expectedHash) {
      if (calculatedHash !== this.expectedHash) {
        return { status: "error", error: "Hash check failed: payload corrupted" };
      }
      hashVerified = true;
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

    const payload: ReassembledPayload = {
      transferId: this.transferId || "unknown",
      fileName: this.fileName || "downloaded-file",
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      blob,
      text,
      hash: calculatedHash,
      hashVerified,
    };

    this.completedPayload = payload;
    return { status: "completed", payload };
  }

  reset(): void {
    this.transferId = null;
    this.totalChunks = 0;
    this.fileName = "";
    this.fileSize = 0;
    this.mimeType = "";
    this.isCompressed = false;
    this.expectedHash = null;
    this.completedPayload = null;
    this.chunks.clear();
    this.parityGroups.clear();
  }

  getProgress() {
    return {
      totalChunks: this.totalChunks,
      receivedCount: this.chunks.size,
      percentage: this.totalChunks > 0 ? Math.round((this.chunks.size / this.totalChunks) * 100) : 0,
    };
  }
}
