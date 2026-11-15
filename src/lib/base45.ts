/**
 * Base45 Encoding & Decoding (RFC 9285).
 * Designed for QR code Alphanumeric Mode to achieve ~97% byte packing efficiency.
 */

export const BASE45_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const DECODE_MAP = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE45_ALPHABET.length; i++) {
  DECODE_MAP[BASE45_ALPHABET.charCodeAt(i)] = i;
}

/**
 * Encodes a byte array into a Base45 string.
 */
export function encodeBase45(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return "";

  let result = "";
  const len = bytes.length;
  let i = 0;

  while (i + 1 < len) {
    const n = bytes[i] * 256 + bytes[i + 1];
    const c = n % 45;
    const d = Math.floor(n / 45) % 45;
    const e = Math.floor(n / 2025);
    result += BASE45_ALPHABET[c] + BASE45_ALPHABET[d] + BASE45_ALPHABET[e];
    i += 2;
  }

  if (i < len) {
    const n = bytes[i];
    const c = n % 45;
    const d = Math.floor(n / 45);
    result += BASE45_ALPHABET[c] + BASE45_ALPHABET[d];
  }

  return result;
}

/**
 * Decodes a Base45 string into a byte array. Returns null on invalid input (never throws).
 */
export function decodeBase45(text: string): Uint8Array | null {
  if (text === null || text === undefined || typeof text !== "string") return null;
  if (text.length === 0) return new Uint8Array(0);
  if (text.length % 3 === 1) return null; // A single trailing char is invalid in Base45

  // Calculate output byte length: (floor(len / 3) * 2) + (len % 3 === 2 ? 1 : 0)
  const fullTriplets = Math.floor(text.length / 3);
  const hasRemainder = text.length % 3 === 2;
  const outLen = fullTriplets * 2 + (hasRemainder ? 1 : 0);
  const out = new Uint8Array(outLen);

  let outIdx = 0;
  let i = 0;

  while (i + 2 < text.length) {
    const cCode = text.charCodeAt(i);
    const dCode = text.charCodeAt(i + 1);
    const eCode = text.charCodeAt(i + 2);

    if (cCode > 127 || dCode > 127 || eCode > 127) return null;
    const c = DECODE_MAP[cCode];
    const d = DECODE_MAP[dCode];
    const e = DECODE_MAP[eCode];

    if (c === -1 || d === -1 || e === -1) return null;

    const n = c + d * 45 + e * 2025;
    if (n > 65535) return null;

    out[outIdx++] = Math.floor(n / 256);
    out[outIdx++] = n % 256;
    i += 3;
  }

  if (hasRemainder) {
    const cCode = text.charCodeAt(i);
    const dCode = text.charCodeAt(i + 1);

    if (cCode > 127 || dCode > 127) return null;
    const c = DECODE_MAP[cCode];
    const d = DECODE_MAP[dCode];

    if (c === -1 || d === -1) return null;

    const n = c + d * 45;
    if (n > 255) return null;

    out[outIdx++] = n;
  }

  return out;
}
