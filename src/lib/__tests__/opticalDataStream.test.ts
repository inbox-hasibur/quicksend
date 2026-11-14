import { describe, it, expect } from "vitest";
import {
  encodeFileToOpticalFrames,
  encodeTextToOpticalFrames,
  isOpticalDataFrame,
  parseOpticalDataFrame,
  OpticalDataCollector,
} from "@/lib/opticalDataStream";

describe("Optical Data Stream Protocol", () => {
  it("should encode plain text into valid sequenced optical frames", async () => {
    const text = "Hello QuickSend Optical Stream! Air-gapped file sharing with zero network.";
    const frames = await encodeTextToOpticalFrames(text, 20); // Small chunk size to force multiple frames

    expect(frames.length).toBeGreaterThan(1);
    expect(frames[0].chunkIndex).toBe(0);
    expect(frames[0].totalChunks).toBe(frames.length);
    expect(isOpticalDataFrame(frames[0].encodedPayload)).toBe(true);

    const parsed = parseOpticalDataFrame(frames[0].encodedPayload);
    expect(parsed).not.toBeNull();
    expect(parsed?.fileName).toBe("message.txt");
    expect(parsed?.totalChunks).toBe(frames.length);
  });

  it("should reassemble frames received in out-of-order sequence", async () => {
    const originalText = "The quick brown fox jumps over the lazy dog. 1234567890! Special: &%#$";
    const frames = await encodeTextToOpticalFrames(originalText, 15);
    expect(frames.length).toBeGreaterThan(2);

    const collector = new OpticalDataCollector();

    // Shuffle frames out of order
    const shuffled = [...frames].sort(() => Math.random() - 0.5);

    let completedPayload = null;
    for (let i = 0; i < shuffled.length; i++) {
      const result = await collector.ingestFrame(shuffled[i].encodedPayload);
      if (result.status === "completed") {
        completedPayload = result.payload;
      }
    }

    expect(completedPayload).not.toBeNull();
    expect(completedPayload?.text).toBe(originalText);
    expect(completedPayload?.fileName).toBe("message.txt");
  });

  it("should tolerate duplicate frames without double counting", async () => {
    const text = "Testing duplicate frame ingestion in optical stream.";
    const frames = await encodeTextToOpticalFrames(text, 20);

    const collector = new OpticalDataCollector();

    // Ingest frame 0 multiple times
    await collector.ingestFrame(frames[0].encodedPayload);
    const progressAfterDup = await collector.ingestFrame(frames[0].encodedPayload);

    if (progressAfterDup.status === "collecting") {
      expect(progressAfterDup.receivedCount).toBe(1);
    }
  });

  it("should encode and reassemble binary file accurately", async () => {
    const binaryData = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04, 0x42]);
    const file = new File([binaryData], "test-binary.dat", { type: "application/octet-stream" });

    const frames = await encodeFileToOpticalFrames(file, 4);
    expect(frames.length).toBe(3);

    const collector = new OpticalDataCollector();
    let completed = null;
    for (const frame of frames) {
      const res = await collector.ingestFrame(frame.encodedPayload);
      if (res.status === "completed") {
        completed = res.payload;
      }
    }

    expect(completed).not.toBeNull();
    expect(completed?.fileName).toBe("test-binary.dat");
    const reassembledBuf = await completed!.blob.arrayBuffer();
    expect(new Uint8Array(reassembledBuf)).toEqual(binaryData);
  });
});
