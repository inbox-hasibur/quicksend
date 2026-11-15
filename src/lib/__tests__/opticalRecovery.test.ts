import { describe, it, expect } from "vitest";
import {
  encodeRecoveryCode,
  decodeRecoveryCode,
  formatMissingRanges,
  parseMissingRanges,
} from "../opticalRecovery";
import { RECOVERY_WORDS, wordToIndex } from "../recoveryWords";

describe("Word-Based Recovery System", () => {
  const sessionHash = "811C9DC5";

  it("RECOVERY_WORDS has length 256, all unique, unique 3-letter prefixes, only a-z 3-6 chars", () => {
    expect(RECOVERY_WORDS.length).toBe(256);

    const wordSet = new Set(RECOVERY_WORDS);
    expect(wordSet.size).toBe(256);

    const prefixSet = new Set(RECOVERY_WORDS.map((w) => w.slice(0, 3)));
    expect(prefixSet.size).toBe(256);

    for (const w of RECOVERY_WORDS) {
      expect(w).toMatch(/^[a-z]{3,6}$/);
    }

    // wordToIndex test
    expect(wordToIndex("ace")).toBe(0);
    expect(wordToIndex("ACE")).toBe(0);
    expect(wordToIndex("ac")).toBe(-1);
    expect(wordToIndex("zzz")).toBe(-1);
  });

  it("round-trips single frame [22]", () => {
    const code = encodeRecoveryCode(sessionHash, [22]);
    expect(code).not.toBeNull();
    const res = decodeRecoveryCode(code!, sessionHash);
    expect(res.ok).toBe(true);
    expect(res.indices).toEqual([22]);
  });

  it("round-trips range list [22, 43, 44, 45, 46, 120]", () => {
    const list = [22, 43, 44, 45, 46, 120];
    const code = encodeRecoveryCode(sessionHash, list);
    expect(code).not.toBeNull();
    const res = decodeRecoveryCode(code!, sessionHash);
    expect(res.ok).toBe(true);
    expect(res.indices).toEqual(list);
  });

  it("round-trips 1 to 50 consecutive frames", () => {
    const list = Array.from({ length: 50 }, (_, i) => i);
    const code = encodeRecoveryCode(sessionHash, list);
    expect(code).not.toBeNull();
    const res = decodeRecoveryCode(code!, sessionHash);
    expect(res.ok).toBe(true);
    expect(res.indices).toEqual(list);
  });

  it("returns null when total word count exceeds 40 for many scattered frames", () => {
    // 30 non-adjacent frames require at least 30 * 2 = 60 payload bytes > 40 words
    const scattered = Array.from({ length: 30 }, (_, i) => i * 4);
    const code = encodeRecoveryCode(sessionHash, scattered);
    expect(code).toBeNull();
  });

  it("supports typed words using only the first 3 letters of each word", () => {
    const code = encodeRecoveryCode(sessionHash, [22, 43]);
    expect(code).not.toBeNull();
    const threeLetterCode = code!
      .split(" ")
      .map((w) => w.slice(0, 3))
      .join(" ");

    const res = decodeRecoveryCode(threeLetterCode, sessionHash);
    expect(res.ok).toBe(true);
    expect(res.indices).toEqual([22, 43]);
  });

  it("handles mixed case, commas, and hyphens", () => {
    const code = encodeRecoveryCode(sessionHash, [22, 43]);
    expect(code).not.toBeNull();
    const words = code!.split(" ");
    // Join with mixed punctuation and case
    const messyCode = words
      .map((w, idx) => (idx % 2 === 0 ? w.toUpperCase() : w))
      .reduce((acc, w, idx) => (idx === 0 ? w : `${acc}${idx % 2 === 0 ? ", " : "-"}${w}`), "");

    const res = decodeRecoveryCode(messyCode, sessionHash);
    expect(res.ok).toBe(true);
    expect(res.indices).toEqual([22, 43]);
  });

  it("rejects one-word typo with checksum failure", () => {
    const code = encodeRecoveryCode(sessionHash, [22, 43]);
    expect(code).not.toBeNull();
    const words = code!.split(" ");
    // Change second word to a different valid word
    const altWord = words[1] === RECOVERY_WORDS[0] ? RECOVERY_WORDS[1] : RECOVERY_WORDS[0];
    words[1] = altWord;
    const altered = words.join(" ");

    const res = decodeRecoveryCode(altered, sessionHash);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("checksum");
  });

  it("rejects wrong session hash with session failure", () => {
    const code = encodeRecoveryCode(sessionHash, [22]);
    expect(code).not.toBeNull();
    const res = decodeRecoveryCode(code!, "00000000");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("session");
  });

  it("rejects unknown words with word failure", () => {
    const res = decodeRecoveryCode("xyz foo bar qux", sessionHash);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("word");
  });

  it("rejects malformed code with format failure", () => {
    expect(decodeRecoveryCode("", sessionHash).ok).toBe(false);
    expect(decodeRecoveryCode("ace", sessionHash).ok).toBe(false);
  });

  it("preserves formatMissingRanges and parseMissingRanges helpers", () => {
    expect(formatMissingRanges([0, 1, 2, 5])).toBe("1-3,6");
    expect(parseMissingRanges("1-3,6")).toEqual([0, 1, 2, 5]);
  });
});
