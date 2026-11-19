import { describe, it, expect } from "vitest";
import {
  newRelayId,
  newFileId,
  planChunks,
  chunkPath,
  chunkAad,
  isValidChunkPath,
  cipherSize,
} from "../relayChunks";
import {
  RELAY_CHUNK_BYTES,
  RELAY_MAX_FILE_BYTES,
  RELAY_TAG_BYTES,
} from "../relayLimits";

describe("relayChunks", () => {
  it("generates 32-char lowercase hex relay IDs and 16-char file IDs", () => {
    const rid1 = newRelayId();
    const rid2 = newRelayId();
    expect(rid1).toMatch(/^[0-9a-f]{32}$/);
    expect(rid2).toMatch(/^[0-9a-f]{32}$/);
    expect(rid1).not.toBe(rid2);

    const fid1 = newFileId();
    const fid2 = newFileId();
    expect(fid1).toMatch(/^[0-9a-f]{16}$/);
    expect(fid2).toMatch(/^[0-9a-f]{16}$/);
    expect(fid1).not.toBe(fid2);
  });

  describe("planChunks", () => {
    it("handles 0 bytes by returning an empty plan", () => {
      expect(planChunks(0)).toEqual([]);
      expect(planChunks(-10)).toEqual([]);
    });

    it("handles 1 byte with a single chunk", () => {
      const plan = planChunks(1);
      expect(plan).toEqual([{ index: 0, start: 0, end: 1 }]);
    });

    it("handles exactly 8 MiB (RELAY_CHUNK_BYTES) with a single chunk", () => {
      const plan = planChunks(RELAY_CHUNK_BYTES);
      expect(plan).toEqual([{ index: 0, start: 0, end: RELAY_CHUNK_BYTES }]);
    });

    it("handles 8 MiB + 1 byte with 2 chunks", () => {
      const size = RELAY_CHUNK_BYTES + 1;
      const plan = planChunks(size);
      expect(plan).toEqual([
        { index: 0, start: 0, end: RELAY_CHUNK_BYTES },
        { index: 1, start: RELAY_CHUNK_BYTES, end: size },
      ]);
    });

    it("handles 750 MiB (RELAY_MAX_FILE_BYTES) with 94 chunks", () => {
      const plan = planChunks(RELAY_MAX_FILE_BYTES);
      const expectedCount = Math.ceil(RELAY_MAX_FILE_BYTES / RELAY_CHUNK_BYTES);
      expect(plan.length).toBe(expectedCount);
      expect(plan[0]).toEqual({ index: 0, start: 0, end: RELAY_CHUNK_BYTES });
      expect(plan[expectedCount - 1]).toEqual({
        index: expectedCount - 1,
        start: (expectedCount - 1) * RELAY_CHUNK_BYTES,
        end: RELAY_MAX_FILE_BYTES,
      });
      // Contiguous boundaries check
      for (let i = 0; i < plan.length; i++) {
        expect(plan[i].index).toBe(i);
        if (i > 0) {
          expect(plan[i].start).toBe(plan[i - 1].end);
        }
      }
    });
  });

  describe("chunkPath and chunkAad", () => {
    it("constructs correct chunk path format", () => {
      const path = chunkPath("123456", "3f8b09", "abc123456789def0", 3);
      expect(path).toBe("relay/123456/3f8b09/abc123456789def0-3.bin");
    });

    it("constructs correct AAD format", () => {
      const aad = chunkAad("abc123456789def0", 2, 5);
      expect(aad).toBe("abc123456789def0:2:5");
    });

    it("computes cipher size including tag bytes", () => {
      expect(cipherSize(100)).toBe(100 + RELAY_TAG_BYTES);
      expect(cipherSize(RELAY_CHUNK_BYTES)).toBe(RELAY_CHUNK_BYTES + 16);
    });
  });

  describe("isValidChunkPath", () => {
    const roomCode = "123456";
    const rid = "0123456789abcdef0123456789abcdef";
    const fileId = "0123456789abcdef";

    it("accepts valid chunk paths for index 0 through 99", () => {
      expect(isValidChunkPath(chunkPath(roomCode, rid, fileId, 0), roomCode, rid)).toBe(true);
      expect(isValidChunkPath(chunkPath(roomCode, rid, fileId, 15), roomCode, rid)).toBe(true);
      expect(isValidChunkPath(chunkPath(roomCode, rid, fileId, 49), roomCode, rid)).toBe(true);
      expect(isValidChunkPath(chunkPath(roomCode, rid, fileId, 99), roomCode, rid)).toBe(true);
    });

    it("rejects index 100", () => {
      const path100 = `relay/${roomCode}/${rid}/${fileId}-100.bin`;
      expect(isValidChunkPath(path100, roomCode, rid)).toBe(false);
    });

    it("rejects wrong room code", () => {
      const validPath = chunkPath(roomCode, rid, fileId, 0);
      expect(isValidChunkPath(validPath, "999999", rid)).toBe(false);
    });

    it("rejects wrong rid", () => {
      const validPath = chunkPath(roomCode, rid, fileId, 0);
      expect(isValidChunkPath(validPath, roomCode, "fedcba9876543210fedcba9876543210")).toBe(false);
    });

    it("rejects path traversal attempts", () => {
      expect(isValidChunkPath(`../relay/${roomCode}/${rid}/${fileId}-0.bin`, roomCode, rid)).toBe(false);
      expect(isValidChunkPath(`relay/${roomCode}/${rid}/../${fileId}-0.bin`, roomCode, rid)).toBe(false);
      expect(isValidChunkPath(`relay/../../etc/passwd`, roomCode, rid)).toBe(false);
      expect(isValidChunkPath(`relay/${roomCode}/${rid}/${fileId}-0.bin/../hacked`, roomCode, rid)).toBe(false);
    });

    it("rejects invalid fileId formats or non-bin extensions", () => {
      expect(isValidChunkPath(`relay/${roomCode}/${rid}/short-0.bin`, roomCode, rid)).toBe(false);
      expect(isValidChunkPath(`relay/${roomCode}/${rid}/${fileId}-0.exe`, roomCode, rid)).toBe(false);
      expect(isValidChunkPath(`relay/${roomCode}/${rid}/${fileId}-0.bin.js`, roomCode, rid)).toBe(false);
    });
  });
});
