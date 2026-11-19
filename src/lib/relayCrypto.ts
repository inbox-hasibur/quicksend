// Relay cryptography utilities with zero server-side key exposure

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function getCrypto(): Crypto {
  if (typeof crypto === "undefined") {
    throw new Error("Encryption needs HTTPS");
  }
  return crypto;
}

function getSubtle(): SubtleCrypto {
  const c = getCrypto();
  if (!c.subtle) {
    throw new Error("Encryption needs HTTPS");
  }
  return c.subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary =
    typeof Buffer !== "undefined"
      ? Buffer.from(base64, "base64").toString("binary")
      : atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates an 8-char relay code formatted as "XXXX-XXXX".
 */
export function generateRelayCode(): string {
  const c = getCrypto();
  const bytes = new Uint8Array(8);
  c.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/**
 * Normalizes and validates an 8-char relay code.
 * Strips whitespace/hyphens and uppercases.
 */
export function normalizeRelayCode(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const clean = input.toUpperCase().replace(/[\s-]/g, "");
  if (clean.length !== 8) return null;
  for (let i = 0; i < clean.length; i++) {
    if (!ALPHABET.includes(clean[i])) {
      return null;
    }
  }
  return clean;
}

/**
 * Generates a crypto-random 6-digit numeric OTP formatted as "123-456".
 */
export function generateNumericOtp(): string {
  const c = getCrypto();
  const array = new Uint32Array(1);
  c.getRandomValues(array);
  const num = 100000 + (array[0] % 900000);
  const raw = num.toString();
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}`;
}

/**
 * Normalizes user input by stripping spaces and dashes, ensuring exactly 6 digits.
 */
export function normalizeNumericOtp(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const clean = input.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  return clean;
}

/**
 * Computes SHA-256("qs-room:" + otp6) and returns the first 16 lowercase hex characters.
 * Server stores and matches this room ID without ever seeing the raw 6-digit OTP.
 */
export async function deriveRoomIdFromOtp(otp6: string): Promise<string> {
  const clean = normalizeNumericOtp(otp6) || otp6.replace(/[\s-]/g, "");
  const subtle = getSubtle();
  const data = new TextEncoder().encode(`qs-room:${clean}`);
  const hash = await subtle.digest("SHA-256", data);
  const hashBytes = new Uint8Array(hash);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    hex += hashBytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Generates 16 random bytes encoded as base64 string.
 */
export function generateSalt(): string {
  const c = getCrypto();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

/**
 * Derives a non-extractable AES-GCM 256 key from a relay code or 6-digit numeric OTP and salt via PBKDF2 SHA-256.
 */
export async function deriveRelayKey(
  code: string,
  saltBase64: string
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const normalized =
    normalizeNumericOtp(code) ||
    normalizeRelayCode(code) ||
    code.replace(/[\s-]/g, "");

  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(normalized),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const salt = base64ToBytes(saltBase64);
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 200000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a UTF-8 text string using AES-GCM with a random 12-byte IV.
 */
export async function encryptText(
  key: CryptoKey,
  text: string
): Promise<{ iv: string; cipher: ArrayBuffer }> {
  const subtle = getSubtle();
  const c = getCrypto();
  const iv = new Uint8Array(12);
  c.getRandomValues(iv);
  const data = new TextEncoder().encode(text);
  const cipher = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data
  );
  return { iv: bytesToBase64(iv), cipher };
}

/**
 * Decrypts cipher buffer into UTF-8 text string. Throws Error("Wrong relay code") on failure.
 */
export async function decryptText(
  key: CryptoKey,
  ivBase64: string,
  cipher: BufferSource
): Promise<string> {
  const subtle = getSubtle();
  try {
    const iv = base64ToBytes(ivBase64);
    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      cipher
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Wrong relay code");
  }
}

/**
 * Generates 4 random bytes encoded as base64 string for chunk IV prefix.
 */
export function generateIvPrefix(): string {
  const c = getCrypto();
  const bytes = new Uint8Array(4);
  c.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

/**
 * Builds a 12-byte AES-GCM IV from a 4-byte base64 prefix and 8-byte big-endian chunk index.
 */
function buildChunkIv(ivPrefixBase64: string, index: number): Uint8Array {
  const prefix = base64ToBytes(ivPrefixBase64);
  if (prefix.length !== 4) {
    throw new Error("Invalid IV prefix: expected 4 bytes");
  }
  const iv = new Uint8Array(12);
  iv.set(prefix, 0);
  const view = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
  view.setBigUint64(4, BigInt(index), false);
  return iv;
}

/**
 * Encrypts a chunk ArrayBuffer using AES-GCM with deterministic IV and AAD.
 */
export async function encryptChunk(
  key: CryptoKey,
  plain: ArrayBuffer,
  ivPrefixBase64: string,
  index: number,
  aad: string
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  const iv = buildChunkIv(ivPrefixBase64, index);
  const encodedAad = new TextEncoder().encode(aad);
  return subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
      additionalData: encodedAad as unknown as BufferSource,
    },
    key,
    plain
  );
}

/**
 * Decrypts a chunk cipher ArrayBuffer using AES-GCM. Throws Error("Wrong relay code") on failure.
 */
export async function decryptChunk(
  key: CryptoKey,
  cipher: ArrayBuffer,
  ivPrefixBase64: string,
  index: number,
  aad: string
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  try {
    const iv = buildChunkIv(ivPrefixBase64, index);
    const encodedAad = new TextEncoder().encode(aad);
    return await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as unknown as BufferSource,
        additionalData: encodedAad as unknown as BufferSource,
      },
      key,
      cipher
    );
  } catch {
    throw new Error("Wrong relay code");
  }
}
