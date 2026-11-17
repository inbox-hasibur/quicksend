import { describe, it, expect } from "vitest";
import {
  generateRelayCode,
  normalizeRelayCode,
  generateSalt,
  deriveRelayKey,
  encryptBytes,
  decryptBytes,
  encryptText,
  decryptText,
} from "../relayCrypto";

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

  it("performs file / byte buffer round trip encryption and decryption", () => {
    return (async () => {
      const code = "ABCDEFGH";
      const salt = generateSalt();
      const key = await deriveRelayKey(code, salt);

      const fileData = new Uint8Array([1, 2, 3, 4, 5, 255, 254, 0, 128, 64]);
      const { iv, cipher } = await encryptBytes(key, fileData);

      const decrypted = await decryptBytes(key, iv, cipher);
      expect(new Uint8Array(decrypted)).toEqual(fileData);
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
});
