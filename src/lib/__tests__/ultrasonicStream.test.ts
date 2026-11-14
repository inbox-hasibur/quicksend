import { describe, it, expect } from "vitest";
import {
  textToNibbles,
  nibblesToText,
  nibbleToFrequency,
  frequencyToNibble,
  classifyTone,
  ULTRASONIC_PRESETS,
} from "@/lib/ultrasonicStream";

describe("Ultrasonic Sound Stream Protocol", () => {
  it("should round-trip text to nibbles and back accurately", () => {
    const originalText = "QS-948271";
    const nibbles = textToNibbles(originalText);

    expect(nibbles.length).toBe(originalText.length * 2);
    const decoded = nibblesToText(nibbles);
    expect(decoded).toBe(originalText);
  });

  it("should handle multi-byte Unicode strings cleanly", () => {
    const text = "QuickSend 🚀 বাংলা";
    const nibbles = textToNibbles(text);
    const decoded = nibblesToText(nibbles);
    expect(decoded).toBe(text);
  });

  it("should map nibbles to frequencies within near-ultrasonic spectrum", () => {
    const config = ULTRASONIC_PRESETS.nearUltrasonic;

    expect(nibbleToFrequency(0, config)).toBe(18000);
    expect(nibbleToFrequency(15, config)).toBe(19500);

    // Test reverse frequency decoding
    expect(frequencyToNibble(18000, config)).toBe(0);
    expect(frequencyToNibble(18010, config)).toBe(0); // within tolerance
    expect(frequencyToNibble(18500, config)).toBe(5);
    expect(frequencyToNibble(19505, config)).toBe(15);
    expect(frequencyToNibble(15000, config)).toBeNull(); // out of band
  });

  it("should classify start, stop, and data tones correctly", () => {
    const config = ULTRASONIC_PRESETS.nearUltrasonic;

    expect(classifyTone(config.startFreq, config)).toBe("start");
    expect(classifyTone(config.stopFreq, config)).toBe("stop");
    expect(classifyTone(18200, config)).toBe("data");
    expect(classifyTone(12000, config)).toBe("unknown");
  });
});
