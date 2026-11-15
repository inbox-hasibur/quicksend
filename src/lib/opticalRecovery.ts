/**
 * Optical Transfer Recovery Code Encoder & Decoder.
 * Generates compact typed recovery codes (e.g. QSR-811C-22,43-46,120-3Z)
 * enabling the sender to replay only the frames lost to camera shake.
 */

export interface DecodeRecoveryResult {
  ok: boolean;
  indices?: number[];
  reason?: "format" | "session" | "checksum";
}

/**
 * Calculates a 2-character base-36 checksum over the ranges string.
 */
function computeRangesChecksum(ranges: string): string {
  let sum = 0;
  for (let i = 0; i < ranges.length; i++) {
    sum = (sum + ranges.charCodeAt(i)) % 1296; // 36 * 36 = 1296
  }
  return sum.toString(36).padStart(2, "0").toLowerCase();
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
 * Encodes session hash and missing indices into a recovery code string.
 * Returns null if the condensed ranges string exceeds 600 characters.
 */
export function encodeRecoveryCode(
  sessionHash: string,
  missingIndices: number[]
): string | null {
  if (!sessionHash) return null;
  const hashPrefix = sessionHash.slice(0, 4).toLowerCase();
  const ranges = formatMissingRanges(missingIndices);

  if (ranges.length > 600) {
    return null;
  }

  const checksum = computeRangesChecksum(ranges);
  return `QSR-${hashPrefix}-${ranges}-${checksum}`;
}

/**
 * Decodes a recovery code and validates it against the current session hash.
 */
export function decodeRecoveryCode(
  code: string,
  sessionHash: string
): DecodeRecoveryResult {
  if (!code || typeof code !== "string" || !sessionHash) {
    return { ok: false, reason: "format" };
  }

  // Case-insensitive, strip whitespace
  const clean = code.replace(/\s+/g, "");
  const parts = clean.split("-");

  // Format: QSR-<4-char-hash>-<ranges>-<2-char-checksum>
  // ranges can contain hyphens (e.g. 43-46), so split length >= 4
  if (parts.length < 4 || parts[0].toUpperCase() !== "QSR") {
    return { ok: false, reason: "format" };
  }

  const hashPart = parts[1].toLowerCase();
  const expectedHashPrefix = sessionHash.slice(0, 4).toLowerCase();
  if (hashPart !== expectedHashPrefix) {
    return { ok: false, reason: "session" };
  }

  const checksumPart = parts[parts.length - 1].toLowerCase();
  const rangesPart = parts.slice(2, parts.length - 1).join("-");

  const expectedChecksum = computeRangesChecksum(rangesPart);
  if (checksumPart !== expectedChecksum) {
    return { ok: false, reason: "checksum" };
  }

  const indices = parseMissingRanges(rangesPart);
  if (indices === null) {
    return { ok: false, reason: "format" };
  }

  return { ok: true, indices };
}
