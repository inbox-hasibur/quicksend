import { describe, it, expect } from "vitest";
import {
  createFileHeader,
  createTextHeader,
  formatBytes,
  formatSpeed,
  sliceBlobIntoChunks,
  reassembleChunksToBlob,
  reassembleChunksToText,
  computeSha256,
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

  it("should create accurate batch file headers with batch metadata", () => {
    const file = new File(["Batch file data"], "file2.pdf", {
      type: "application/pdf",
    });
    const header = createFileHeader(file, 64 * 1024, {
      batchId: "batch_abc123",
      fileIndex: 2,
      totalFiles: 5,
      totalBatchBytes: 1048576,
      sha256: "dummy-hash-hex",
    });

    expect(header.batchId).toBe("batch_abc123");
    expect(header.fileIndex).toBe(2);
    expect(header.totalFiles).toBe(5);
    expect(header.totalBatchBytes).toBe(1048576);
    expect(header.sha256).toBe("dummy-hash-hex");
  });

  it("should compute accurate SHA-256 hex digest for blob payloads", async () => {
    const blob = new Blob(["hello world"], { type: "text/plain" });
    const hash = await computeSha256(blob);

    // Known SHA-256 digest of "hello world"
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("should return null gracefully if crypto.subtle is unavailable", async () => {
    const originalCrypto = globalThis.crypto;
    try {
      // @ts-expect-error simulating non-secure context
      delete globalThis.crypto;
      const blob = new Blob(["test"], { type: "text/plain" });
      const hash = await computeSha256(blob);
      expect(hash).toBeNull();
    } finally {
      globalThis.crypto = originalCrypto;
    }
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
