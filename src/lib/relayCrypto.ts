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
 * Generates 16 random bytes encoded as base64 string.
 */
export function generateSalt(): string {
  const c = getCrypto();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

/**
 * Derives a non-extractable AES-GCM 256 key from a relay code and salt via PBKDF2 SHA-256.
 */
export async function deriveRelayKey(
  code: string,
  saltBase64: string
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
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
 * Encrypts raw binary buffer using AES-GCM with a random 12-byte IV.
 */
export async function encryptBytes(
  key: CryptoKey,
  data: BufferSource
): Promise<{ iv: string; cipher: ArrayBuffer }> {
  const subtle = getSubtle();
  const c = getCrypto();
  const iv = new Uint8Array(12);
  c.getRandomValues(iv);
  const cipher = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data
  );
  return { iv: bytesToBase64(iv), cipher };
}

/**
 * Decrypts raw cipher buffer using AES-GCM and base64 IV. Throws Error("Wrong relay code") on failure.
 */
export async function decryptBytes(
  key: CryptoKey,
  ivBase64: string,
  cipher: BufferSource
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  try {
    const iv = base64ToBytes(ivBase64);
    return await subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      cipher
    );
  } catch {
    throw new Error("Wrong relay code");
  }
}

/**
 * Encrypts a UTF-8 text string.
 */
export async function encryptText(
  key: CryptoKey,
  text: string
): Promise<{ iv: string; cipher: ArrayBuffer }> {
  return encryptBytes(key, new TextEncoder().encode(text));
}

/**
 * Decrypts cipher buffer into UTF-8 text string.
 */
export async function decryptText(
  key: CryptoKey,
  ivBase64: string,
  cipher: BufferSource
): Promise<string> {
  const plain = await decryptBytes(key, ivBase64, cipher);
  return new TextDecoder().decode(plain);
}
