import { describe, it, expect } from "vitest";
import {
  textToNibbles,
  nibblesToText,
  nibbleToFrequency,
  frequencyToNibble,
  classifyTone,
  encodePayloadToAcousticNibbles,
  decodeAcousticNibblesToPayload,
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

  it("should encode and decode text payload via structured acoustic packets", async () => {
    const message = "Secret PIN: 839201";
    const encoded = await encodePayloadToAcousticNibbles({ text: message });

    expect(encoded.isBinary).toBe(false);
    expect(encoded.fileName).toBe("message.txt");
    expect(encoded.rawString.startsWith("UA1|0|text|")).toBe(true);

    const decoded = decodeAcousticNibblesToPayload(encoded.nibbles);
    expect(decoded).not.toBeNull();
    expect(decoded?.isBinary).toBe(false);
    expect(decoded?.data).toBe(message);
  });

  it("should encode and decode binary file payload with bit-perfect integrity", async () => {
    const fileBytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21]); // "Hello!"
    const file = new File([fileBytes], "greeting.txt", { type: "text/plain" });

    const encoded = await encodePayloadToAcousticNibbles({ file });
    expect(encoded.isBinary).toBe(true);
    expect(encoded.fileName).toBe("greeting.txt");
    expect(encoded.rawString.startsWith("UA1|1|greeting.txt|")).toBe(true);

    const decoded = decodeAcousticNibblesToPayload(encoded.nibbles);
    expect(decoded).not.toBeNull();
    expect(decoded?.isBinary).toBe(true);
    expect(decoded?.fileName).toBe("greeting.txt");
    expect(decoded?.blob).toBeDefined();

    const recoveredBuf = await decoded!.blob!.arrayBuffer();
    expect(new Uint8Array(recoveredBuf)).toEqual(fileBytes);
  });
});
