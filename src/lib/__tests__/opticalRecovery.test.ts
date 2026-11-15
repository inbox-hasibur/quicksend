import { describe, it, expect } from "vitest";
import {
  encodeRecoveryCode,
  decodeRecoveryCode,
  formatMissingRanges,
  parseMissingRanges,
} from "../opticalRecovery";

describe("opticalRecovery", () => {
  const sessionHash = "811c9dc5";

  it("should format missing ranges into condensed 1-based format", () => {
    // 0-based indices [21, 42, 43, 44, 45, 119] -> 1-based 22, 43-46, 120
    const indices = [21, 42, 43, 44, 45, 119];
    const ranges = formatMissingRanges(indices);
    expect(ranges).toBe("22,43-46,120");

    const parsed = parseMissingRanges(ranges);
    expect(parsed).toEqual(indices);
  });

  it("should perform full encode/decode round trip with case-insensitivity and whitespace tolerance", () => {
    const missing = [0, 4, 5, 6, 10, 19];
    const code = encodeRecoveryCode(sessionHash, missing);
    expect(code).not.toBeNull();
    expect(code).toMatch(/^QSR-811c-1,5-7,11,20-[0-9a-z]{2}$/i);

    // Decode exact
    const res = decodeRecoveryCode(code!, sessionHash);
    expect(res.ok).toBe(true);
    expect(res.indices).toEqual(missing);

    // Decode uppercase with whitespace
    const spaced = `  QSR - 811C - 1, 5-7, 11, 20 - ${code!.slice(-2).toUpperCase()}  `;
    const resSpaced = decodeRecoveryCode(spaced, sessionHash);
    expect(resSpaced.ok).toBe(true);
    expect(resSpaced.indices).toEqual(missing);
  });

  it("should reject invalid checksum caused by typo", () => {
    const code = encodeRecoveryCode(sessionHash, [5, 6, 7])!;
    // Corrupt a digit in the range
    const corrupted = code.replace("6-8", "6-9");
    const res = decodeRecoveryCode(corrupted, sessionHash);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("checksum");
  });

  it("should return reason 'session' when session hash prefix does not match", () => {
    const code = encodeRecoveryCode(sessionHash, [2, 3, 4])!;
    const res = decodeRecoveryCode(code, "9999ffff");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("session");
  });

  it("should return null if ranges string exceeds 600 characters", () => {
    // Generate thousands of non-consecutive indices to produce a long string
    const sparseIndices: number[] = [];
    for (let i = 0; i < 400; i++) {
      sparseIndices.push(i * 3);
    }
    const code = encodeRecoveryCode(sessionHash, sparseIndices);
    expect(code).toBeNull();
  });

  it("should return reason 'format' on malformed input strings", () => {
    expect(decodeRecoveryCode("INVALID-CODE", sessionHash)).toEqual({
      ok: false,
      reason: "format",
    });
    expect(decodeRecoveryCode("QSR-811c-bad_range-00", sessionHash)).toEqual({
      ok: false,
      reason: "checksum",
    });
  });
});
