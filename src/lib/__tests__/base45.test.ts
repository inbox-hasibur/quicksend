import { describe, it, expect } from "vitest";
import { encodeBase45, decodeBase45 } from "../base45";

describe("Base45 Codec (RFC 9285)", () => {
  it("encodes and decodes RFC 9285 test vectors accurately", () => {
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    // Vector 1: 'AB' -> 'BB8'
    expect(encodeBase45(enc.encode("AB"))).toBe("BB8");
    expect(dec.decode(decodeBase45("BB8")!)).toBe("AB");

    // Vector 2: 'Hello!!' -> '%69 VD92EX0'
    expect(encodeBase45(enc.encode("Hello!!"))).toBe("%69 VD92EX0");
    expect(dec.decode(decodeBase45("%69 VD92EX0")!)).toBe("Hello!!");

    // Vector 3: 'base-45' -> 'UJCLQE7W581'
    expect(encodeBase45(enc.encode("base-45"))).toBe("UJCLQE7W581");
    expect(dec.decode(decodeBase45("UJCLQE7W581")!)).toBe("base-45");

    // Vector 4: 'QED8WEX0' -> 'ietf!'
    expect(dec.decode(decodeBase45("QED8WEX0")!)).toBe("ietf!");
  });

  it("handles empty input", () => {
    expect(encodeBase45(new Uint8Array(0))).toBe("");
    const decoded = decodeBase45("");
    expect(decoded).not.toBeNull();
    expect(decoded?.length).toBe(0);
  });

  it("handles random 1000-byte round-trip", () => {
    const bytes = new Uint8Array(1000);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    const encoded = encodeBase45(bytes);
    const decoded = decodeBase45(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded).toEqual(bytes);
  });

  it("rejects invalid inputs gracefully without throwing", () => {
    // Single trailing char (length % 3 === 1)
    expect(decodeBase45("A")).toBeNull();
    expect(decodeBase45("BB8A")).toBeNull();

    // Disallowed characters (lowercase, special symbols outside alphabet)
    expect(decodeBase45("abc")).toBeNull();
    expect(decodeBase45("BB8@")).toBeNull();
    expect(decodeBase45("BB8#")).toBeNull();

    // Value exceeding 65535 in 3-char group
    // 44 + 44*45 + 44*2025 = 91124 > 65535. Char 44 is ':'
    expect(decodeBase45(":::")).toBeNull();

    // Value exceeding 255 in 2-char group
    // 44 + 44*45 = 2024 > 255
    expect(decodeBase45("::")).toBeNull();
  });
});
