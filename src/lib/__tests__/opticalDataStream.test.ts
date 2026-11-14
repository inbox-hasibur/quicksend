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

  it("should perform full round-trip with multi-byte UTF-8, out-of-order delivery, and duplicate frames", async () => {
    const complexText = "🌟 QuickSend Optical 2.0: Bengali (বাংলা), Japanese (日本語), Arabic (العربية), & Emojis! 🚀⚡🔥";
    const frames = await encodeTextToOpticalFrames(complexText, 25);
    expect(frames.length).toBeGreaterThan(3);

    const collector = new OpticalDataCollector();

    // Create a sequence with reversed order AND duplicates
    const mixedDelivery = [
      ...frames.slice().reverse(),
      frames[1], // duplicate
      frames[0], // duplicate
      frames[Math.floor(frames.length / 2)], // duplicate
    ];

    let finalPayload = null;
    for (const frame of mixedDelivery) {
      const res = await collector.ingestFrame(frame.encodedPayload);
      if (res.status === "completed") {
        finalPayload = res.payload;
      }
    }

    expect(finalPayload).not.toBeNull();
    expect(finalPayload?.text).toBe(complexText);
    expect(finalPayload?.mimeType).toBe("text/plain");
  });

  it("should correctly reset collector state when a frame from a new transfer arrives", async () => {
    const textA = "Transfer A Payload";
    const textB = "Transfer B Payload";

    const framesA = await encodeTextToOpticalFrames(textA, 10);
    const framesB = await encodeTextToOpticalFrames(textB, 10);

    const collector = new OpticalDataCollector();

    // Ingest first frame of transfer A
    const resA = await collector.ingestFrame(framesA[0].encodedPayload);
    expect(resA.status).toBe("collecting");
    if (resA.status === "collecting") {
      expect(resA.transferId).toBe(framesA[0].transferId);
    }

    // Ingest first frame of transfer B (should reset and track B)
    const resB = await collector.ingestFrame(framesB[0].encodedPayload);
    expect(resB.status).toBe("collecting");
    if (resB.status === "collecting") {
      expect(resB.transferId).toBe(framesB[0].transferId);
      expect(resB.receivedCount).toBe(1);
    }
  });
});
