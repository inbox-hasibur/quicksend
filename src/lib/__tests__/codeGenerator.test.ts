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

  it("should format a 6-digit code with hyphen in the center", () => {
    expect(formatRoomCode("834291")).toBe("834-291");
    expect(formatRoomCode("834-291")).toBe("834-291");
    expect(formatRoomCode("12")).toBe("12");
  });

  it("should normalize room code input by removing non-alphanumeric chars", () => {
    expect(normalizeRoomCode(" 834 - 291 ")).toBe("834291");
    expect(normalizeRoomCode("abc-def")).toBe("ABCDEF");
    expect(normalizeRoomCode("")).toBe("");
  });

  it("should validate room code length and characters", () => {
    expect(isValidRoomCode("834291")).toBe(true);
    expect(isValidRoomCode("834-291")).toBe(true);
    expect(isValidRoomCode("ABC-DEF")).toBe(true);
    expect(isValidRoomCode("12345")).toBe(false);
    expect(isValidRoomCode("1234567")).toBe(false);
    expect(isValidRoomCode("")).toBe(false);
  });
});
