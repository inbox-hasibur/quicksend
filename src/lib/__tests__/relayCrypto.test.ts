import { describe, it, expect } from "vitest";
import {
  generateRelayCode,
  normalizeRelayCode,
  generateSalt,
  generateIvPrefix,
  deriveRelayKey,
  encryptText,
  decryptText,
  encryptChunk,
  decryptChunk,
} from "../relayCrypto";
import { chunkAad } from "../relayChunks";

describe("relayCrypto", () => {
  it("normalizes and validates relay codes correctly", () => {
    expect(normalizeRelayCode("k7m2 9qxa")).toBe("K7M29QXA");
    expect(normalizeRelayCode("K7M2-9QXA")).toBe("K7M29QXA");
    expect(normalizeRelayCode("  k7m2-9qxa  ")).toBe("K7M29QXA");
    // Invalid characters (0, 1, I, O not in alphabet)
    expect(normalizeRelayCode("01IO-ABCD")).toBeNull();
    // Too short / too long
    expect(normalizeRelayCode("K7M2")).toBeNull();
    expect(normalizeRelayCode("K7M29QXA123")).toBeNull();
  });

  it("generates 8-char formatted codes and 16-byte base64 salts", () => {
    const code = generateRelayCode();
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(normalizeRelayCode(code)).toBeTruthy();

    const salt = generateSalt();
    const bytes = Buffer.from(salt, "base64");
    expect(bytes.length).toBe(16);
  });

  it("performs text round trip encryption and decryption", () => {
    return (async () => {
      const code = "K7M29QXA";
      const salt = generateSalt();
      const key = await deriveRelayKey(code, salt);

      const secretText = "Hello QuickSend encrypted relay message! 🚀";
      const { iv, cipher } = await encryptText(key, secretText);

      const decrypted = await decryptText(key, iv, cipher);
      expect(decrypted).toBe(secretText);
    })();
  });


  it("throws 'Wrong relay code' when derived with wrong code", () => {
    return (async () => {
      const correctCode = "K7M29QXA";
      const wrongCode = "ZZZZZZZZ";
      const salt = generateSalt();

      const keyA = await deriveRelayKey(correctCode, salt);
      const keyB = await deriveRelayKey(wrongCode, salt);

      const { iv, cipher } = await encryptText(keyA, "Secret document");

      await expect(decryptText(keyB, iv, cipher)).rejects.toThrow("Wrong relay code");
    })();
  });

  it("throws 'Wrong relay code' when one byte is flipped in cipher", () => {
    return (async () => {
      const code = "K7M29QXA";
      const salt = generateSalt();
      const key = await deriveRelayKey(code, salt);

      const { iv, cipher } = await encryptText(key, "Tamper resistance test");
      const tampered = new Uint8Array(cipher);
      tampered[0] ^= 0x01; // Flip one bit/byte

      await expect(decryptText(key, iv, tampered)).rejects.toThrow("Wrong relay code");
    })();
  });

  describe("chunk encryption and decryption", () => {
    it("generates 4-byte base64 ivPrefix", () => {
      const prefix = generateIvPrefix();
      const bytes = Buffer.from(prefix, "base64");
      expect(bytes.length).toBe(4);
    });

    it("performs round trip encryption and decryption for 3 chunks with single derived key", async () => {
      const code = "ABCDEFGH";
      const salt = generateSalt();
      const key = await deriveRelayKey(code, salt);
      const ivPrefix = generateIvPrefix();
      const fileId = "0123456789abcdef";
      const count = 3;

      const chunk0 = new Uint8Array([10, 20, 30, 40]).buffer;
      const chunk1 = new Uint8Array([50, 60, 70, 80, 90]).buffer;
      const chunk2 = new Uint8Array([100, 110, 120]).buffer;
      const chunks = [chunk0, chunk1, chunk2];

      for (let i = 0; i < count; i++) {
        const aad = chunkAad(fileId, i, count);
        const cipher = await encryptChunk(key, chunks[i], ivPrefix, i, aad);
        expect(cipher.byteLength).toBe(chunks[i].byteLength + 16);

        const decrypted = await decryptChunk(key, cipher, ivPrefix, i, aad);
        expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(chunks[i]));
      }
    });

    it("fails decryption when chunk order is swapped due to AAD mismatch", async () => {
      const code = "ABCDEFGH";
      const salt = generateSalt();
      const key = await deriveRelayKey(code, salt);
      const ivPrefix = generateIvPrefix();
      const fileId = "0123456789abcdef";
      const count = 3;

      const chunk0 = new Uint8Array([1, 2, 3, 4]).buffer;
      const aad0 = chunkAad(fileId, 0, count);
      const cipher0 = await encryptChunk(key, chunk0, ivPrefix, 0, aad0);

      // Attempting to decrypt chunk0 as chunk1 (wrong index in IV and wrong AAD)
      const aad1 = chunkAad(fileId, 1, count);
      await expect(decryptChunk(key, cipher0, ivPrefix, 1, aad1)).rejects.toThrow("Wrong relay code");
    });

    it("fails decryption when derived with wrong relay code", async () => {
      const correctCode = "K7M29QXA";
      const wrongCode = "ZZZZZZZZ";
      const salt = generateSalt();
      const keyA = await deriveRelayKey(correctCode, salt);
      const keyB = await deriveRelayKey(wrongCode, salt);
      const ivPrefix = generateIvPrefix();
      const fileId = "0123456789abcdef";

      const chunk = new Uint8Array([99, 88, 77, 66]).buffer;
      const aad = chunkAad(fileId, 0, 1);
      const cipher = await encryptChunk(keyA, chunk, ivPrefix, 0, aad);

      await expect(decryptChunk(keyB, cipher, ivPrefix, 0, aad)).rejects.toThrow("Wrong relay code");
    });
  });
});
