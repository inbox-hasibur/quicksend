import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  formatRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
} from "@/lib/codeGenerator";

describe("codeGenerator utilities", () => {
  it("should generate a 6-digit numeric room code", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^\d{6}$/);
    const num = parseInt(code, 10);
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThanOrEqual(999999);
  });

  it("should format a 6-digit code with hyphen and preserve mobile numbers or keywords", () => {
    expect(formatRoomCode("834291")).toBe("834-291");
    expect(formatRoomCode("834-291")).toBe("834-291");
    expect(formatRoomCode("01712345678")).toBe("01712345678");
    expect(formatRoomCode("HR998877")).toBe("HR998877");
    expect(formatRoomCode("12")).toBe("12");
  });

  it("should normalize room code input by removing non-alphanumeric chars and extracting from URLs", () => {
    expect(normalizeRoomCode(" 834 - 291 ")).toBe("834291");
    expect(normalizeRoomCode("abc-def")).toBe("ABCDEF");
    expect(normalizeRoomCode("+880 1712-345678")).toBe("8801712345678");
    expect(normalizeRoomCode("hr-998877")).toBe("HR998877");
    expect(normalizeRoomCode("https://quicksend.vercel.app/?room=834291")).toBe("834291");
    expect(normalizeRoomCode("/?room=834291")).toBe("834291");
    expect(normalizeRoomCode("https://example.com/share?pin=998811")).toBe("998811");
    expect(normalizeRoomCode("")).toBe("");
  });

  it("should validate room code length and characters", () => {
    // 6-digit numeric PIN
    expect(isValidRoomCode("834291")).toBe(true);
    expect(isValidRoomCode("834-291")).toBe(true);
    // Custom alphanumeric keywords
    expect(isValidRoomCode("ABC-DEF")).toBe(true);
    expect(isValidRoomCode("HR998877")).toBe(true);
    // Mobile numbers
    expect(isValidRoomCode("01712345678")).toBe(true);
    expect(isValidRoomCode("+880 1712-345678")).toBe(true);
    // Minimum 4 chars
    expect(isValidRoomCode("ABCD")).toBe(true);
    expect(isValidRoomCode("123")).toBe(false);
    // Maximum 20 chars
    expect(isValidRoomCode("A".repeat(20))).toBe(true);
    expect(isValidRoomCode("A".repeat(21))).toBe(false);
    expect(isValidRoomCode("")).toBe(false);
  });
});
