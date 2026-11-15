/**
 * Optical Transfer Recovery Code Encoder & Decoder.
 * Generates compact typed recovery codes (e.g. QSR-811C-22,43-46,120-3Z)
 * and human-friendly word-text recovery codes (e.g. river fox 22, 43-46, 120)
 * enabling the sender to replay only the frames lost to camera shake.
 */

export interface DecodeRecoveryResult {
  ok: boolean;
  indices?: number[];
  reason?: "format" | "session" | "checksum";
}

/**
 * Curated 256 common, friendly 3-6 letter English words for human-readable codes.
 * Distinct, non-confusing nouns and nature words mapping 8 bits (0-255) per word.
 */
export const RECOVERY_WORD_LIST = [
  "ace", "amber", "apple", "aqua", "arch", "arrow", "atlas", "badge",
  "barn", "beach", "beam", "bear", "bell", "berry", "bird", "blade",
  "blue", "boat", "bold", "bolt", "book", "branch", "brave", "breeze",
  "brick", "bridge", "bright", "brook", "brush", "cabin", "cable", "calm",
  "camel", "camp", "canyon", "cape", "cedar", "charm", "cliff", "cloud",
  "clover", "coast", "comet", "coral", "cove", "crane", "creek", "crest",
  "crown", "crystal", "daisy", "dawn", "deer", "delta", "desert", "diamond",
  "dolphin", "dove", "drift", "dune", "eagle", "echo", "ember", "emerald",
  "falcon", "fawn", "feather", "fern", "field", "finch", "fir", "fire",
  "flame", "flash", "flint", "flora", "flow", "forest", "fox", "frost",
  "galaxy", "garden", "gate", "glade", "glacier", "glow", "gold", "grain",
  "grape", "grove", "gull", "harbor", "haven", "hawk", "hazel", "hill",
  "hollow", "horizon", "hound", "ice", "inlet", "island", "ivy", "jade",
  "jasper", "jay", "jewel", "jungle", "kelp", "kite", "lagoon", "lake",
  "lamp", "lane", "lark", "leaf", "light", "lily", "lime", "lion",
  "lodge", "lotus", "lunar", "maple", "marsh", "meadow", "mesa", "mint",
  "mist", "moon", "moss", "mountain", "nectar", "nest", "north", "nova",
  "oak", "oasis", "ocean", "olive", "opal", "orbit", "orchid", "otter",
  "owl", "palm", "panda", "path", "peak", "pearl", "pebble", "pine",
  "planet", "plover", "plum", "pond", "poppy", "prairie", "prism", "quail",
  "quartz", "quill", "rain", "raven", "ray", "reef", "ridge", "ripple",
  "river", "robin", "rock", "rose", "ruby", "sage", "sail", "salmon",
  "sand", "sapphire", "sea", "seal", "shadow", "shell", "shore", "silver",
  "sky", "slate", "snow", "solar", "song", "spark", "sparrow", "spring",
  "spruce", "star", "stone", "storm", "stream", "summit", "sun", "swan",
  "swift", "talon", "teal", "thistle", "thorn", "tide", "tiger", "timber",
  "topaz", "trail", "tree", "tulip", "tundra", "valley", "vapor", "vine",
  "violet", "walnut", "wave", "well", "whale", "wheat", "willow", "wind",
  "wing", "wolf", "wood", "wren", "zenith", "anchor", "beacon", "blaze",
  "blossom", "canopy", "cascade", "chime", "citrus", "clover", "canyon", "comet",
  "den", "elm", "ember", "fern", "flare", "flora", "fossil", "glade",
  "grove", "haven", "iris", "island", "jasper", "juniper", "lapis", "meadow",
] as const;

/**
 * Converts the first 4 hex characters of a session hash into 2 readable words.
 */
export function hashToWords(sessionHash: string): [string, string] {
  if (!sessionHash || sessionHash.length < 4) {
    return ["quick", "send"];
  }
  const clean = sessionHash.toLowerCase().replace(/[^0-9a-f]/g, "").padEnd(4, "0");
  const b0 = parseInt(clean.slice(0, 2), 16) % 256;
  const b1 = parseInt(clean.slice(2, 4), 16) % 256;
  return [RECOVERY_WORD_LIST[b0] || "quick", RECOVERY_WORD_LIST[b1] || "send"];
}

/**
 * Converts 2 words back to a 4-character hex hash prefix if found in word list.
 */
export function wordsToHash(w1: string, w2: string): string | null {
  const i0 = (RECOVERY_WORD_LIST as readonly string[]).indexOf(w1.toLowerCase());
  const i1 = (RECOVERY_WORD_LIST as readonly string[]).indexOf(w2.toLowerCase());
  if (i0 === -1 || i1 === -1) return null;
  return i0.toString(16).padStart(2, "0") + i1.toString(16).padStart(2, "0");
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
 * Supports comma separation, whitespace, and "to" syntax (e.g. "22, 43-46, 120" or "43 to 46").
 */
export function parseMissingRanges(ranges: string): number[] | null {
  if (!ranges || ranges.trim() === "") return [];

  // Normalize delimiters: colons, commas, "to", and hyphens with surrounding spaces
  const normalized = ranges
    .replace(/:/g, " ")
    .replace(/\s*-\s*|\s+to\s+/gi, "-")
    .replace(/,/g, " ");

  const parts = normalized.trim().split(/\s+/);
  const indicesSet = new Set<number>();

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

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
 * Encodes session hash and missing indices into a readable word-text recovery code.
 * Example: "river fox 22, 43-46, 120"
 */
export function encodeWordRecoveryCode(
  sessionHash: string,
  missingIndices: number[]
): string | null {
  if (!sessionHash || !missingIndices || missingIndices.length === 0) return null;
  const ranges = formatMissingRanges(missingIndices);
  if (ranges.length > 600) return null;
  const [w1, w2] = hashToWords(sessionHash);
  const readableRanges = ranges.replace(/,/g, ", ");
  return `${w1} ${w2} ${readableRanges}`;
}

/**
 * Decodes a recovery code and validates it against the current session hash.
 * Supports:
 * - Legacy format: QSR-<hashPrefix>-<ranges>-<checksum>
 * - Word-text format: "river fox 22, 43-46, 120"
 * - Direct numbers: "22, 43-46, 120" or "43 to 46"
 */
export function decodeRecoveryCode(
  code: string,
  sessionHash: string
): DecodeRecoveryResult {
  if (!code || typeof code !== "string" || !sessionHash) {
    return { ok: false, reason: "format" };
  }

  const trimmed = code.trim();

  // 1. Legacy QSR format: QSR-<4-char-hash>-<ranges>-<2-char-checksum>
  const cleanQsr = trimmed.replace(/\s+/g, "");
  if (cleanQsr.toUpperCase().startsWith("QSR-")) {
    const parts = cleanQsr.split("-");
    if (parts.length < 4) {
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
    if (indices === null || indices.length === 0) {
      return { ok: false, reason: "format" };
    }

    return { ok: true, indices };
  }

  // 2. Word-text format ("river fox 22, 43-46, 120") or Direct numbers ("22, 43-46")
  const firstDigitMatch = trimmed.search(/\d/);
  if (firstDigitMatch === -1) {
    return { ok: false, reason: "format" };
  }

  const textPrefix = trimmed.slice(0, firstDigitMatch).trim();
  const rangePart = trimmed.slice(firstDigitMatch).trim();

  // If words are present before digits, validate session prefix words
  const words = textPrefix.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length >= 2) {
    const [expW1, expW2] = hashToWords(sessionHash);
    const w1 = words[0];
    const w2 = words[1];
    if (w1 !== expW1 || w2 !== expW2) {
      return { ok: false, reason: "session" };
    }
  }

  const indices = parseMissingRanges(rangePart);
  if (indices === null || indices.length === 0) {
    return { ok: false, reason: "format" };
  }

  return { ok: true, indices };
}
