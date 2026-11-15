/**
 * Optical Transfer Word-Based Recovery Code Encoder & Decoder.
 * Generates human-readable recovery codes using 256 common English words
 * enabling the sender to replay only frames lost to camera shake.
 */

import { RECOVERY_WORDS, wordToIndex } from "./recoveryWords";

export interface DecodeRecoveryResult {
  ok: boolean;
  indices?: number[];
  reason?: "format" | "session" | "checksum" | "word";
}

/**
 * Encodes an unsigned integer into a 7-bit varint byte array (LEB128).
 */
function encodeVarint(val: number): number[] {
  const bytes: number[] = [];
  let v = val;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  bytes.push(v & 0x7f);
  return bytes;
}

/**
 * Decodes a sequence of varints from byte array. Returns null on malformed sequence.
 */
function decodeVarints(bytes: number[]): number[] | null {
  const values: number[] = [];
  let current = 0;
  let shift = 0;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    current |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) {
      values.push(current);
      current = 0;
      shift = 0;
    } else {
      shift += 7;
      if (shift > 28) return null; // Avoid 32-bit overflow
    }
  }

  if (shift !== 0) return null; // Trailing incomplete varint
  return values;
}

/**
 * Converts 0-based missing frame indices into 1-based condensed range string (e.g. "22,43-46,120").
 */
export function formatMissingRanges(indices: number[]): string {
  if (!indices || indices.length === 0) return "";
  const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
  const oneBased = sorted.map((i) => i + 1);

  const parts: string[] = [];
  let start = oneBased[0];
  let end = start;

  for (let i = 1; i < oneBased.length; i++) {
    if (oneBased[i] === end + 1) {
      end = oneBased[i];
    } else {
      parts.push(start === end ? `${start}` : `${start}-${end}`);
      start = oneBased[i];
      end = start;
    }
  }
  parts.push(start === end ? `${start}` : `${start}-${end}`);
  return parts.join(",");
}

/**
 * Parses 1-based range string into sorted 0-based unique frame indices.
 */
export function parseMissingRanges(ranges: string): number[] | null {
  if (!ranges || ranges.trim() === "") return [];

  const parts = ranges.split(",");
  const indicesSet = new Set<number>();

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) return null;

    if (trimmed.includes("-")) {
      const bounds = trimmed.split("-");
      if (bounds.length !== 2) return null;
      const start = parseInt(bounds[0], 10);
      const end = parseInt(bounds[1], 10);
      if (isNaN(start) || isNaN(end) || start <= 0 || end < start) {
        return null;
      }
      for (let i = start; i <= end; i++) {
        indicesSet.add(i - 1);
      }
    } else {
      const val = parseInt(trimmed, 10);
      if (isNaN(val) || val <= 0) return null;
      indicesSet.add(val - 1);
    }
  }

  return Array.from(indicesSet).sort((a, b) => a - b);
}

/**
 * Encodes session hash and missing indices into a sequence of human-readable words.
 * Returns null if the word count exceeds 40 words or session is missing.
 */
export function encodeRecoveryCode(
  sessionHash: string,
  missingIndices: number[]
): string | null {
  if (!sessionHash || typeof sessionHash !== "string" || !missingIndices || missingIndices.length === 0) {
    return null;
  }

  const sessionByte = parseInt(sessionHash.slice(0, 2), 16);
  if (isNaN(sessionByte)) return null;

  // Convert 0-based missing indices into sorted 1-based ranges
  const sorted1 = Array.from(new Set(missingIndices))
    .map((i) => i + 1)
    .sort((a, b) => a - b);

  const ranges: Array<[number, number]> = [];
  let rStart = sorted1[0];
  let rEnd = rStart;

  for (let i = 1; i < sorted1.length; i++) {
    if (sorted1[i] === rEnd + 1) {
      rEnd = sorted1[i];
    } else {
      ranges.push([rStart, rEnd]);
      rStart = sorted1[i];
      rEnd = rStart;
    }
  }
  if (rStart !== undefined) {
    ranges.push([rStart, rEnd]);
  }

  const payloadBytes: number[] = [];
  let prevEnd = 0;

  for (const [s, e] of ranges) {
    const gap = s - prevEnd;
    const len = e - s;
    payloadBytes.push(...encodeVarint(gap));
    payloadBytes.push(...encodeVarint(len));
    prevEnd = e;
  }

  // Checksum byte: (session byte + sum of payload bytes) % 256
  const payloadSum = payloadBytes.reduce((acc, b) => acc + b, 0);
  const checksumByte = (sessionByte + payloadSum) % 256;

  const allBytes = [sessionByte, ...payloadBytes, checksumByte];
  if (allBytes.length > 40) {
    return null;
  }

  return allBytes.map((b) => RECOVERY_WORDS[b]).join(" ");
}

/**
 * Decodes a human-readable recovery code and validates it against the current session hash.
 */
export function decodeRecoveryCode(
  code: string,
  sessionHash: string
): DecodeRecoveryResult {
  if (!code || typeof code !== "string" || !sessionHash) {
    return { ok: false, reason: "format" };
  }

  const tokens = code.trim().split(/[\s,-]+/).filter(Boolean);
  if (tokens.length < 3) {
    return { ok: false, reason: "format" };
  }

  const bytes: number[] = [];
  for (const token of tokens) {
    const idx = wordToIndex(token);
    if (idx === -1) {
      return { ok: false, reason: "word" };
    }
    bytes.push(idx);
  }

  const expectedSessionByte = parseInt(sessionHash.slice(0, 2), 16);
  if (isNaN(expectedSessionByte) || bytes[0] !== expectedSessionByte) {
    return { ok: false, reason: "session" };
  }

  const payloadBytes = bytes.slice(1, -1);
  const checksumByte = bytes[bytes.length - 1];

  const payloadSum = payloadBytes.reduce((acc, b) => acc + b, 0);
  const expectedChecksum = (expectedSessionByte + payloadSum) % 256;
  if (checksumByte !== expectedChecksum) {
    return { ok: false, reason: "checksum" };
  }

  const values = decodeVarints(payloadBytes);
  if (!values || values.length % 2 !== 0) {
    return { ok: false, reason: "format" };
  }

  const missingIndices: number[] = [];
  let prevEnd = 0;

  for (let i = 0; i < values.length; i += 2) {
    const gap = values[i];
    const len = values[i + 1];
    const start = prevEnd + gap;
    const end = start + len;

    for (let f = start; f <= end; f++) {
      missingIndices.push(f - 1);
    }
    prevEnd = end;
  }

  return { ok: true, indices: missingIndices };
}
