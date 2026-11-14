import { describe, it, expect } from "vitest";
import {
  createFileHeader,
  createTextHeader,
  formatBytes,
  formatSpeed,
  sliceBlobIntoChunks,
  reassembleChunksToBlob,
  reassembleChunksToText,
} from "@/lib/chunker";

describe("chunker & stream reassembly utilities", () => {
  it("should create accurate file header with chunk counts", () => {
    const file = new File(["Hello world content"], "test.txt", {
      type: "text/plain",
    });
    const header = createFileHeader(file, 5); // 5 bytes per chunk
    expect(header.type).toBe("file");
    expect(header.file?.name).toBe("test.txt");
    expect(header.file?.size).toBe(19);
    expect(header.totalChunks).toBe(4);
    expect(header.chunkSize).toBe(5);
  });

  it("should create accurate text header with preview and lengths", () => {
    const text = "A".repeat(100);
    const header = createTextHeader(text, 30);
    expect(header.type).toBe("text");
    expect(header.text?.length).toBe(100);
    expect(header.text?.preview).toHaveLength(83); // 80 chars + "..."
    expect(header.totalChunks).toBe(4);
  });

  it("should format bytes into human-readable units", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
    expect(formatBytes(512)).toBe("512 Bytes");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("should format transfer speeds with units", () => {
    expect(formatSpeed(0)).toBe("0 KB/s");
    expect(formatSpeed(500000)).toBe("488.3 KB/s");
    expect(formatSpeed(2000000)).toBe("1.9 MB/s");
  });

  it("should slice a blob into chunks and reassemble accurately", async () => {
    const originalText = "The quick brown fox jumps over the lazy dog. 1234567890!";
    const blob = new Blob([originalText], { type: "text/plain" });

    const chunks: ArrayBuffer[] = [];
    for await (const chunkInfo of sliceBlobIntoChunks(blob, 10)) {
      chunks.push(chunkInfo.chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);

    // Reassemble text
    const reassembledText = reassembleChunksToText(chunks);
    expect(reassembledText).toBe(originalText);

    // Reassemble blob
    const reassembledBlob = reassembleChunksToBlob(chunks, "text/plain");
    expect(reassembledBlob.size).toBe(blob.size);
    expect(reassembledBlob.type).toBe("text/plain");
  });
});
