/**
 * Optical Data Stream Protocol for Zero-Network Camera-to-Screen Transfer.
 * Streams files and text as a sequenced carousel of high-contrast QR codes
 * scanned by the opposite device's camera viewfinder.
 * Includes XOR parity frames for automatic packet recovery and typed recovery codes.
 */

import { encodeBase45, decodeBase45 } from "@/lib/base45";

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
  small: 90,
  medium: 200,
  large: 390,
} as const;

export type OpticalChunkPreset = keyof typeof OPTICAL_CHUNK_PRESETS;

export const DEFAULT_CHUNK_RAW_BYTES = OPTICAL_CHUNK_PRESETS.medium; // 200 bytes default

/**
 * Fast 32-bit FNV-1a payload checksum formatted as 8-character uppercase hex.
 */
export function computePayloadHash(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
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

export function encodeB45Header(str: string): string {
  const rawB45 = encodeBase45(new TextEncoder().encode(str));
  return rawB45.replace(/%/g, "%P").replace(/:/g, "%C");
}

export function decodeB45Header(str: string): string {
  const unescaped = str.replace(/%C/g, ":").replace(/%P/g, "%");
  const bytes = decodeBase45(unescaped);
  if (!bytes) return "";
  return new TextDecoder().decode(bytes);
}

/**
 * Splits string on the first N occurrences of delimiter.
 */
export function splitFirstN(str: string, delimiter: string, n: number): string[] {
  const parts: string[] = [];
  let cur = str;
  for (let i = 0; i < n; i++) {
    const idx = cur.indexOf(delimiter);
    if (idx === -1) break;
    parts.push(cur.slice(0, idx));
    cur = cur.slice(idx + delimiter.length);
  }
  parts.push(cur);
  return parts;
}

/**
 * Encodes an ArrayBuffer or Blob into sequenced optical QR frames.
 */
export async function encodeFileToOpticalFrames(
  file: File,
  chunkSize: number = DEFAULT_CHUNK_RAW_BYTES
): Promise<OpticalDataFrame[]> {
  const buffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(buffer);
  const hash = computePayloadHash(rawBytes);
  const transferId = `opt_${hash.slice(0, 8)}`;

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

  const b45Name = encodeB45Header(file.name || "payload.bin");
  const b45Mime = encodeB45Header(file.type || "application/octet-stream");
  const compFlag = isCompressed ? "1" : "0";

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, dataBytes.length);
    const slice = dataBytes.slice(start, end);

    const base45Data = encodeBase45(slice);

    // Protocol format: QS2:<index>:<total>:<HASH>:<fileNameB45>:<fileSize>:<mimeB45>:<isCompressed>:<base45Data>.
    const encodedPayload = `QS2:${i}:${totalChunks}:${hash}:${b45Name}:${file.size}:${b45Mime}:${compFlag}:${base45Data}.`;

    frames.push({
      transferId,
      chunkIndex: i,
      totalChunks,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      isCompressed,
      base64Data: base45Data,
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

  const lastChunkBytes = decodeBase45(dataFrames[K - 1].base64Data) || base64ToBytes(dataFrames[K - 1].base64Data);
  const lastChunkLen = lastChunkBytes.length;
  const lastChunkGroup = (K - 1) % S;
  const hasShortFinalChunk = lastChunkLen < chunkSize;

  for (let g = 0; g < S; g++) {
    const groupFrames = dataFrames.filter((_, idx) => idx % S === g);
    const xorBuffer = new Uint8Array(chunkSize);

    for (const df of groupFrames) {
      const bytes = decodeBase45(df.base64Data) || base64ToBytes(df.base64Data);
      for (let b = 0; b < bytes.length; b++) {
        xorBuffer[b] ^= bytes[b];
      }
    }

    const base45Xor = encodeBase45(xorBuffer);
    const lastLen = g === lastChunkGroup && hasShortFinalChunk ? lastChunkLen : 0;
    // Protocol format: QP2:<g>:<S>:<HASH>:<lastLen>:<base45 xor>.
    const encodedPayload = `QP2:${g}:${S}:${sessionHash}:${lastLen}:${base45Xor}.`;

    parityFrames.push({
      transferId: dataFrames[0]?.transferId || `opt_${sessionHash.slice(0, 8)}`,
      chunkIndex: K + g,
      totalChunks: K + S,
      fileName: dataFrames[0]?.fileName || "parity",
      fileSize: dataFrames[0]?.fileSize || 0,
      mimeType: "application/x-parity",
      isCompressed: false,
      base64Data: base45Xor,
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
  return (
    typeof payload === "string" &&
    payload.endsWith(".") &&
    (payload.startsWith("QS2:") || payload.startsWith("QP2:"))
  );
}

/**
 * Parses an incoming optical data frame string.
 */
export function parseOpticalDataFrame(raw: string): OpticalDataFrame | null {
  try {
    if (!raw || typeof raw !== "string" || !raw.startsWith("QS2:") || !raw.endsWith(".")) {
      return null;
    }

    const trimmed = raw.slice(0, -1);
    const parts9 = splitFirstN(trimmed, ":", 8);

    if (parts9.length === 9) {
      const [, idxStr, totalStr, hash, b45Name, sizeStr, b45Mime, compStr, payload] = parts9;
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
        (compStr !== "0" && compStr !== "1") ||
        !hash ||
        !payload
      ) {
        return null;
      }

      let fileName = "payload.bin";
      let mimeType = "application/octet-stream";
      try {
        fileName = decodeB45Header(b45Name) || "payload.bin";
        mimeType = decodeB45Header(b45Mime) || "application/octet-stream";
      } catch {
        // Keep defaults
      }

      const transferId = `opt_${hash.slice(0, 8)}`;

      return {
        transferId,
        chunkIndex,
        totalChunks,
        fileName,
        fileSize,
        mimeType,
        isCompressed,
        base64Data: payload,
        encodedPayload: raw,
        hash,
        isParity: false,
      };
    }

    const parts5 = splitFirstN(trimmed, ":", 4);
    if (parts5.length === 5) {
      const [, idxStr, totalStr, hash, payload] = parts5;
      const chunkIndex = parseInt(idxStr, 10);
      const totalChunks = parseInt(totalStr, 10);

      if (
        isNaN(chunkIndex) ||
        isNaN(totalChunks) ||
        chunkIndex < 0 ||
        totalChunks <= 0 ||
        chunkIndex >= totalChunks ||
        !hash ||
        !payload
      ) {
        return null;
      }

      const transferId = `opt_${hash.slice(0, 8)}`;

      return {
        transferId,
        chunkIndex,
        totalChunks,
        fileName: "payload.bin",
        fileSize: 0,
        mimeType: "application/octet-stream",
        isCompressed: false,
        base64Data: payload,
        encodedPayload: raw,
        hash,
        isParity: false,
      };
    }

    return null;
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
 * Parses an incoming optical parity frame (QP2:<g>:<S>:<HASH>:<lastLen>:<base45 xor>.).
 */
export function parseOpticalParityFrame(raw: string): ParsedParityFrame | null {
  try {
    if (!raw || typeof raw !== "string" || !raw.startsWith("QP2:") || !raw.endsWith(".")) {
      return null;
    }

    const trimmed = raw.slice(0, -1);
    const parts = splitFirstN(trimmed, ":", 5);
    if (parts.length !== 6) return null;

    const [, gStr, SStr, sessionHash, lastLenStr, base45Data] = parts;
    const group = parseInt(gStr, 10);
    const totalGroups = parseInt(SStr, 10);
    const lastLen = parseInt(lastLenStr, 10);

    if (
      isNaN(group) ||
      isNaN(totalGroups) ||
      group < 0 ||
      totalGroups <= 0 ||
      group >= totalGroups ||
      !sessionHash ||
      !base45Data
    ) {
      return null;
    }

    const xorBytes = decodeBase45(base45Data);
    if (!xorBytes) return null;

    return {
      group,
      totalGroups,
      sessionHash,
      xorBytes,
      lastChunkLen: isNaN(lastLen) || lastLen <= 0 ? undefined : lastLen,
    };
  } catch (err) {
    console.log("PARSE_ERR:", err);
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
    if (!raw || typeof raw !== "string" || !raw.endsWith(".")) return { status: "invalid" };

    if (raw.startsWith("QP2:")) {
      return this.ingestParityFrame(raw);
    }

    if (raw.startsWith("QS2:")) {
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

    // Decode base45 to binary
    if (!this.chunks.has(frame.chunkIndex)) {
      try {
        const bytes = decodeBase45(frame.base64Data);
        if (!bytes) return { status: "invalid" };
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
        if (missingIdx === K - 1 && parity.lastChunkLen !== undefined && parity.lastChunkLen > 0) {
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
