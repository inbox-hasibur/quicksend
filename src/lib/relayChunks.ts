// Utilities for chunk-based encrypted cloud relay planning and path management

import { RELAY_CHUNK_BYTES, RELAY_MAX_CHUNKS_PER_FILE, RELAY_TAG_BYTES } from "./relayLimits";

export interface ChunkPlan {
  index: number;
  start: number;
  end: number;
}

/**
 * Generates a 32-character lowercase hex string from 16 crypto-random bytes.
 */
export function newRelayId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    throw new Error("Crypto API unavailable");
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a 16-character lowercase hex string from 8 crypto-random bytes.
 */
export function newFileId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    throw new Error("Crypto API unavailable");
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Plans chunk boundary offsets for a file using RELAY_CHUNK_BYTES.
 */
export function planChunks(size: number): ChunkPlan[] {
  if (size <= 0) return [];
  const chunks: ChunkPlan[] = [];
  let start = 0;
  let index = 0;
  while (start < size) {
    const end = Math.min(start + RELAY_CHUNK_BYTES, size);
    chunks.push({ index, start, end });
    start = end;
    index++;
  }
  return chunks;
}

/**
 * Constructs the storage pathname for a specific chunk object.
 */
export function chunkPath(
  roomCode: string,
  rid: string,
  fileId: string,
  index: number
): string {
  return `relay/${roomCode}/${rid}/${fileId}-${index}.bin`;
}

/**
 * Constructs Additional Authenticated Data (AAD) for AES-GCM chunk verification.
 */
export function chunkAad(fileId: string, index: number, count: number): string {
  return `${fileId}:${index}:${count}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validates a chunk path against room code and relay ID.
 * Strict checks: fileId must be 16 hex chars, chunk index 0 to 99, no path traversal.
 */
export function isValidChunkPath(path: string, roomCode: string, rid: string): boolean {
  if (!path || !roomCode || !rid) return false;
  if (path.includes("..") || roomCode.includes("..") || rid.includes("..")) return false;
  const roomPattern = escapeRegex(roomCode);
  const ridPattern = escapeRegex(rid);
  const regex = new RegExp(
    `^relay\\/${roomPattern}\\/${ridPattern}\\/([0-9a-f]{16})-(\\d+)\\.bin$`
  );
  const match = path.match(regex);
  if (!match) return false;
  const index = Number.parseInt(match[2], 10);
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < RELAY_MAX_CHUNKS_PER_FILE &&
    String(index) === match[2]
  );
}

/**
 * Calculates ciphertext size in bytes for a given plaintext size.
 */
export function cipherSize(plainBytes: number): number {
  return plainBytes + RELAY_TAG_BYTES;
}
