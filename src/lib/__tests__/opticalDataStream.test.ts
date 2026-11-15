import { describe, it, expect } from "vitest";
import {
  encodeFileToOpticalFrames,
  encodeTextToOpticalFrames,
  parseOpticalDataFrame,
  computePayloadHash,
  buildParityFrames,
  getTotalFrameCount,
  OpticalDataCollector,
  OPTICAL_CHUNK_PRESETS,
  type OpticalDataFrame,
} from "@/lib/opticalDataStream";

describe("Optical Data Stream Protocol", () => {
  /**
   * Helper to simulate real-world webcam scanning conditions:
   * Shuffled order + 30% duplicate frames + first 5 frames looped at the end.
   */
  function buildTortureSequence(frames: OpticalDataFrame[]): string[] {
    const shuffled = [...frames].sort(() => Math.random() - 0.5);
    const dupCount = Math.max(1, Math.floor(frames.length * 0.3));
    const duplicates = frames.slice(0, dupCount).map((f) => f.encodedPayload);
    const combined = [...shuffled.map((f) => f.encodedPayload), ...duplicates].sort(
      () => Math.random() - 0.5
    );
    const loopedEnd = frames.slice(0, Math.min(5, frames.length)).map((f) => f.encodedPayload);
    return [...combined, ...loopedEnd];
  }

  it("should perform full round-trip for 20KB random binary file with shuffled, duplicate, and looped frames", async () => {
    // 20KB random bytes
    const randomBytes = new Uint8Array(20480);
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
    const expectedHash = computePayloadHash(randomBytes);
    const file = new File([randomBytes], "random-20kb.bin", {
      type: "application/octet-stream",
    });

    // Run real sender encoder
    const frames = await encodeFileToOpticalFrames(file);
    expect(frames.length).toBeGreaterThan(10);

    const collector = new OpticalDataCollector();
    const tortureSequence = buildTortureSequence(frames);

    let completedPayload = null;
    for (const rawFrame of tortureSequence) {
      const res = await collector.add(rawFrame);
      if (res.status === "completed") {
        completedPayload = res.payload;
      }
    }

    expect(completedPayload).not.toBeNull();
    expect(completedPayload?.fileName).toBe("random-20kb.bin");
    expect(completedPayload?.fileSize).toBe(20480);
    expect(completedPayload?.hashVerified).toBe(true);
    expect(completedPayload?.hash).toBe(expectedHash);

    const restoredBuf = await completedPayload!.blob.arrayBuffer();
    const restoredBytes = new Uint8Array(restoredBuf);
    expect(restoredBytes.length).toBe(randomBytes.length);
    expect(restoredBytes).toEqual(randomBytes);
  });

  it("should perform full round-trip for short text payload with torture sequence", async () => {
    const shortText = "QuickSend 100% offline optical beam message payload";
    const frames = await encodeTextToOpticalFrames(shortText, 15);
    expect(frames.length).toBeGreaterThan(2);

    const collector = new OpticalDataCollector();
    const tortureSequence = buildTortureSequence(frames);

    let completedPayload = null;
    for (const rawFrame of tortureSequence) {
      const res = await collector.add(rawFrame);
      if (res.status === "completed") {
        completedPayload = res.payload;
      }
    }

    expect(completedPayload).not.toBeNull();
    expect(completedPayload?.text).toBe(shortText);
    expect(completedPayload?.hashVerified).toBe(true);
  });

  it("should reset collector cleanly when second session arrives after incomplete first session", async () => {
    const sessionABytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const fileA = new File([sessionABytes], "fileA.bin", { type: "application/octet-stream" });
    const framesA = await encodeFileToOpticalFrames(fileA, 2);
    expect(framesA.length).toBe(4);

    const sessionBBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const fileB = new File([sessionBBytes], "fileB.bin", { type: "application/octet-stream" });
    const framesB = await encodeFileToOpticalFrames(fileB, 3);

    const collector = new OpticalDataCollector();

    // Ingest only half of Session A (incomplete)
    const resA0 = await collector.add(framesA[0].encodedPayload);
    expect(resA0.status).toBe("collecting");
    const resA1 = await collector.add(framesA[1].encodedPayload);
    expect(resA1.status).toBe("collecting");

    // Ingest all frames of Session B (should automatically reset and complete B)
    let finalPayloadB = null;
    for (const frame of framesB) {
      const res = await collector.add(frame.encodedPayload);
      if (res.status === "completed") {
        finalPayloadB = res.payload;
      }
    }

    expect(finalPayloadB).not.toBeNull();
    expect(finalPayloadB?.fileName).toBe("fileB.bin");
    expect(finalPayloadB?.fileSize).toBe(sessionBBytes.length);
    const restoredB = new Uint8Array(await finalPayloadB!.blob.arrayBuffer());
    expect(restoredB).toEqual(sessionBBytes);
  });

  it("should never throw on garbage or corrupted input and return null", () => {
    const garbageInputs = [
      "",
      "random string",
      "QS1|incomplete",
      "QS1||||||||",
      "QS1|t1|not_number|total|name|size|mime|0|data",
      "QS1|t1|0|5|name|-1|mime|0|data",
      "QS1|t1|10|5|name|100|mime|0|data", // index >= total
      null as unknown as string,
      undefined as unknown as string,
    ];

    for (const input of garbageInputs) {
      expect(() => parseOpticalDataFrame(input)).not.toThrow();
      expect(parseOpticalDataFrame(input)).toBeNull();
    }

    // Invalid URI sequence must not throw
    expect(() => parseOpticalDataFrame("QS1|t1|0|1|bad_%E0%A4%A|10|mime|0|data")).not.toThrow();
  });

  it("should return a clear error value (not exception) when payload hash check fails", async () => {
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    const file = new File([data], "hash-test.dat", { type: "application/octet-stream" });
    const frames = await encodeFileToOpticalFrames(file, 2);

    // Tamper with base64 data in frame 0
    const parts = frames[0].encodedPayload.split("|");
    parts[8] = btoa("corrupted"); // modify base64
    const tamperedPayload = parts.join("|");

    const collector = new OpticalDataCollector();
    await collector.add(tamperedPayload);
    let errorResult = null;
    for (let i = 1; i < frames.length; i++) {
      const res = await collector.add(frames[i].encodedPayload);
      if (res.status === "error") {
        errorResult = res;
      }
    }

    expect(errorResult).not.toBeNull();
    expect(errorResult?.status).toBe("error");
    expect(errorResult?.error).toContain("Hash check failed");
  });

  it("should ensure all OPTICAL_CHUNK_PRESETS produce frames within QR capacity (<= 500 chars for large)", async () => {
    const payload10k = new Uint8Array(10240);
    for (let i = 0; i < payload10k.length; i++) {
      payload10k[i] = (i * 37) % 256;
    }
    const testFile = new File([payload10k], "capacity-test.bin", {
      type: "application/octet-stream",
    });

    for (const [presetName, chunkSize] of Object.entries(OPTICAL_CHUNK_PRESETS)) {
      const frames = await encodeFileToOpticalFrames(testFile, chunkSize);
      expect(frames.length).toBeGreaterThan(0);

      for (const frame of frames) {
        expect(frame.encodedPayload.startsWith("QS1|")).toBe(true);
        if (presetName === "large") {
          expect(frame.encodedPayload.length).toBeLessThanOrEqual(500);
        }
      }
    }
  });

  describe("XOR Parity Recovery", () => {
    it("should calculate total frames correctly (K + ceil(K / 10))", () => {
      expect(getTotalFrameCount(0)).toBe(0);
      expect(getTotalFrameCount(5)).toBe(6);
      expect(getTotalFrameCount(10)).toBe(11);
      expect(getTotalFrameCount(11)).toBe(13); // 11 + ceil(1.1) = 11 + 2 = 13
      expect(getTotalFrameCount(80)).toBe(88);
    });

    it("should fully recover when dropping any single data frame per group", async () => {
      // 50 chunks of 10 bytes = 500 bytes -> S = 5 groups. Use random uncompressible bytes.
      const rawData = new Uint8Array(500);
      for (let i = 0; i < rawData.length; i++) rawData[i] = Math.floor(Math.random() * 256);
      const file = new File([rawData], "parity-single.bin", { type: "application/octet-stream" });

      const dataFrames = await encodeFileToOpticalFrames(file, 10);
      const parityFrames = buildParityFrames(dataFrames, 10);
      expect(dataFrames.length).toBe(50);
      expect(parityFrames.length).toBe(5);

      // Drop 1 data frame from each of the 5 groups: e.g. frame 0 (grp 0), 1 (grp 1), 2 (grp 2), 3 (grp 3), 4 (grp 4)
      const droppedIndices = new Set([0, 1, 2, 3, 4]);
      const survivingData = dataFrames.filter((f) => !droppedIndices.has(f.chunkIndex));

      const collector = new OpticalDataCollector();
      for (const df of survivingData) {
        await collector.add(df.encodedPayload);
      }
      expect(collector.getProgress().receivedCount).toBe(45);

      // Ingest parity frames; each group should automatically recover its missing frame
      let finalRes = null;
      for (const pf of parityFrames) {
        finalRes = await collector.add(pf.encodedPayload);
      }

      expect(finalRes?.status).toBe("completed");
      if (finalRes?.status === "completed") {
        const restored = new Uint8Array(await finalRes.payload.blob.arrayBuffer());
        expect(restored).toEqual(rawData);
      }
    });

    it("should fully recover when dropping a burst of 8 consecutive data frames", async () => {
      // 80 chunks of 10 bytes -> S = 8 groups (stride 8). Use random uncompressible bytes.
      const rawData = new Uint8Array(800);
      for (let i = 0; i < rawData.length; i++) rawData[i] = Math.floor(Math.random() * 256);
      const file = new File([rawData], "parity-burst.bin", { type: "application/octet-stream" });

      const dataFrames = await encodeFileToOpticalFrames(file, 10);
      const parityFrames = buildParityFrames(dataFrames, 10);
      expect(dataFrames.length).toBe(80);
      expect(parityFrames.length).toBe(8);

      // Drop a burst of 8 consecutive frames (indices 24..31).
      // Since S = 8, indices 24..31 belong to groups 0, 1, 2, 3, 4, 5, 6, 7 (exactly 1 per group!)
      const droppedIndices = new Set([24, 25, 26, 27, 28, 29, 30, 31]);
      const survivingData = dataFrames.filter((f) => !droppedIndices.has(f.chunkIndex));

      const collector = new OpticalDataCollector();
      for (const df of survivingData) {
        await collector.add(df.encodedPayload);
      }
      expect(collector.getProgress().receivedCount).toBe(72);

      let finalRes = null;
      for (const pf of parityFrames) {
        finalRes = await collector.add(pf.encodedPayload);
      }

      expect(finalRes?.status).toBe("completed");
      if (finalRes?.status === "completed") {
        const restored = new Uint8Array(await finalRes.payload.blob.arrayBuffer());
        expect(restored).toEqual(rawData);
      }
    });

    it("should NOT recover when dropping 2 frames of the same group with parity alone", async () => {
      const rawData = new Uint8Array(200);
      for (let i = 0; i < rawData.length; i++) rawData[i] = i % 256;
      const file = new File([rawData], "two-lost.bin", { type: "application/octet-stream" });

      const dataFrames = await encodeFileToOpticalFrames(file, 10);
      const parityFrames = buildParityFrames(dataFrames, 10);
      // K = 20, S = 2 groups. Frame 0 and Frame 2 both belong to group 0 (0%2 === 2%2 === 0).
      const droppedIndices = new Set([0, 2]);
      const survivingData = dataFrames.filter((f) => !droppedIndices.has(f.chunkIndex));

      const collector = new OpticalDataCollector();
      for (const df of survivingData) {
        await collector.add(df.encodedPayload);
      }

      let res = null;
      for (const pf of parityFrames) {
        res = await collector.add(pf.encodedPayload);
      }

      // Should still be in collecting state because group 0 had 2 missing frames
      expect(res?.status).toBe("collecting");
      if (res?.status === "collecting") {
        expect(res.missingIndices).toEqual([0, 2]);
        expect(res.receivedCount).toBe(18);
      }
    });

    it("should restore the last short chunk with the correct length and match original bytes", async () => {
      // 25 bytes total with chunk size 10 -> chunks: [10 bytes], [10 bytes], [5 bytes (short!)]
      const rawData = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25,
      ]);
      const file = new File([rawData], "short-last.bin", { type: "application/octet-stream" });

      const dataFrames = await encodeFileToOpticalFrames(file, 10);
      const parityFrames = buildParityFrames(dataFrames, 10);
      expect(dataFrames.length).toBe(3);

      // Drop the final chunk (index 2) which is only 5 bytes
      const collector = new OpticalDataCollector();
      await collector.add(dataFrames[0].encodedPayload);
      await collector.add(dataFrames[1].encodedPayload);

      // Feed parity frame for group (2 % S)
      const res = await collector.add(parityFrames[0].encodedPayload);
      expect(res.status).toBe("completed");

      if (res.status === "completed") {
        expect(res.payload.fileSize).toBe(25);
        const restored = new Uint8Array(await res.payload.blob.arrayBuffer());
        expect(restored.length).toBe(25);
        expect(restored).toEqual(rawData);
      }
    });
  });
});
