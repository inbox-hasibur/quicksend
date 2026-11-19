import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as getStatus } from "../status/route";
import { GET as getAttach, POST as postAttach } from "../attach/route";
import { POST as postComplete } from "../complete/route";
import { GET as getFile } from "../file/route";
import { signalStore } from "@/lib/signalStore";
import {
  RELAY_CHUNK_BYTES,
  RELAY_MAX_FILE_BYTES,
  RELAY_MAX_TRANSFER_BYTES,
  RELAY_MAX_FILES,
  RELAY_TTL_MINUTES,
} from "@/lib/relayLimits";

const mockDel = vi.fn().mockResolvedValue(undefined);
const mockSignedReadUrl = vi.fn((path: string, options?: Record<string, unknown>) => {
  void options;
  return Promise.resolve({
    url: `https://my-bucket.blob.upstash.io/${path}?token=mock_read_sig`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
});
const mockList = vi.fn((options?: { prefix?: string; limit?: number; cursor?: string }) => {
  void options;
  return Promise.resolve({
    blobs: [] as { path: string }[],
    cursor: undefined as string | undefined,
  });
});

vi.mock("@upstash/blob", () => ({
  Bucket: class MockBucket {
    async del(...args: unknown[]) {
      return mockDel(...args);
    }
    async signedReadUrl(...args: unknown[]) {
      return (mockSignedReadUrl as (...a: unknown[]) => unknown)(...args);
    }
    async list(...args: unknown[]) {
      return (mockList as (...a: unknown[]) => unknown)(...args);
    }
  },
}));

describe("Relay API Routes (@upstash/blob Chunked)", () => {
  const originalUrl = process.env.UPSTASH_BLOB_URL;
  const originalToken = process.env.UPSTASH_BLOB_TOKEN;

  const validRoomCode = "123456";
  const validRid = "0123456789abcdef0123456789abcdef";
  const validFileId = "0123456789abcdef";
  const validBaseUrl = "https://my-bucket.blob.upstash.io";

  beforeEach(async () => {
    vi.clearAllMocks();
    await signalStore.clear?.();
    process.env.UPSTASH_BLOB_URL = validBaseUrl;
    process.env.UPSTASH_BLOB_TOKEN = "upstash_token_mock";
  });

  afterEach(() => {
    if (originalUrl !== undefined) {
      process.env.UPSTASH_BLOB_URL = originalUrl;
    } else {
      delete process.env.UPSTASH_BLOB_URL;
    }

    if (originalToken !== undefined) {
      process.env.UPSTASH_BLOB_TOKEN = originalToken;
    } else {
      delete process.env.UPSTASH_BLOB_TOKEN;
    }
  });

  describe("GET /api/relay/status", () => {
    it("returns available: false when UPSTASH_BLOB_TOKEN is unset", async () => {
      delete process.env.UPSTASH_BLOB_TOKEN;
      const res = await getStatus();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.maxFileBytes).toBe(RELAY_MAX_FILE_BYTES);
      expect(data.maxTransferBytes).toBe(RELAY_MAX_TRANSFER_BYTES);
      expect(data.maxFiles).toBe(RELAY_MAX_FILES);
      expect(data.chunkBytes).toBe(RELAY_CHUNK_BYTES);
      expect(data.ttlMinutes).toBe(RELAY_TTL_MINUTES);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns available: true when UPSTASH_BLOB credentials are set", async () => {
      const res = await getStatus();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.available).toBe(true);
    });
  });

  describe("POST /api/relay/attach", () => {
    it("rejects foreign baseUrl", async () => {
      const req = new Request("http://localhost/api/relay/attach", {
        method: "POST",
        body: JSON.stringify({
          roomCode: validRoomCode,
          rid: validRid,
          salt: "c2FsdF9leGFtcGxlXzE2",
          baseUrl: "https://evil.com",
          files: [
            {
              id: validFileId,
              name: "test.txt",
              size: 100,
              chunkCount: 1,
              ivPrefix: "AAAAAA==",
            },
          ],
        }),
      });

      const res = await postAttach(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Forbidden storage host");
    });

    it("rejects chunkCount mismatch", async () => {
      // 10MB file should have ceil(10MB / 4MB) = 3 chunks, but body says 1
      const req = new Request("http://localhost/api/relay/attach", {
        method: "POST",
        body: JSON.stringify({
          roomCode: validRoomCode,
          rid: validRid,
          salt: "c2FsdF9leGFtcGxlXzE2",
          baseUrl: validBaseUrl,
          files: [
            {
              id: validFileId,
              name: "bigfile.bin",
              size: 10 * 1024 * 1024,
              chunkCount: 1, // Mismatched chunkCount
              ivPrefix: "AAAAAA==",
            },
          ],
        }),
      });

      const res = await postAttach(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Chunk count mismatch");
    });

    it("rejects total size over 300 MB", async () => {
      const req = new Request("http://localhost/api/relay/attach", {
        method: "POST",
        body: JSON.stringify({
          roomCode: validRoomCode,
          rid: validRid,
          salt: "c2FsdF9leGFtcGxlXzE2",
          baseUrl: validBaseUrl,
          files: [
            {
              id: "0123456789abcdef",
              name: "file1.bin",
              size: 180 * 1024 * 1024,
              chunkCount: Math.ceil((180 * 1024 * 1024) / RELAY_CHUNK_BYTES),
              ivPrefix: "AAAAAA==",
            },
            {
              id: "fedcba9876543210",
              name: "file2.bin",
              size: 150 * 1024 * 1024,
              chunkCount: Math.ceil((150 * 1024 * 1024) / RELAY_CHUNK_BYTES),
              ivPrefix: "BBBBBB==",
            },
          ],
        }),
      });

      const res = await postAttach(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Total transfer size exceeds limit");
    });

    it("creates a missing room and stores chunked relay manifest", async () => {
      const roomCode = "654321";
      const req = new Request("http://localhost/api/relay/attach", {
        method: "POST",
        body: JSON.stringify({
          roomCode,
          rid: validRid,
          salt: "c2FsdF9leGFtcGxlXzE2",
          baseUrl: validBaseUrl,
          files: [
            {
              id: validFileId,
              name: "document.pdf",
              size: 1024,
              chunkCount: 1,
              ivPrefix: "AAAAAA==",
            },
          ],
          text: {
            cipherText: "ZW5jcnlwdGVkX3RleHQ=",
            iv: "aXZfdGV4dA==",
          },
        }),
      });

      const res = await postAttach(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);

      const storedRoom = await signalStore.getRoom(roomCode, "code");
      expect(storedRoom).not.toBeNull();
      expect(storedRoom?.relay?.rid).toBe(validRid);
      expect(storedRoom?.relay?.files?.[0].id).toBe(validFileId);
      expect(storedRoom?.relay?.text?.cipherText).toBe("ZW5jcnlwdGVkX3RleHQ=");
    });
  });

  describe("GET /api/relay/attach", () => {
    it("returns null for unknown room code", async () => {
      const req = new Request("http://localhost/api/relay/attach?code=999999");
      const res = await getAttach(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.relay).toBeNull();
    });

    it("returns manifest without any encryption key", async () => {
      const roomCode = "123456";
      await signalStore.createRoom(roomCode);
      const room = await signalStore.getRoom(roomCode, "code");
      if (room) {
        await signalStore.updateRoom(room.roomId, (r) => {
          r.relay = {
            salt: "c2FsdA==",
            createdAt: Date.now(),
            rid: validRid,
            baseUrl: validBaseUrl,
            files: [
              {
                id: validFileId,
                name: "test.bin",
                size: 500,
                mimeType: "application/octet-stream",
                chunkCount: 1,
                ivPrefix: "AAAAAA==",
              },
            ],
            items: [],
          };
          return r;
        });
      }

      const req = new Request(`http://localhost/api/relay/attach?code=${roomCode}`);
      const res = await getAttach(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.relay).toBeDefined();
      expect(data.relay.rid).toBe(validRid);
      expect(data.relay.files.length).toBe(1);
      expect(data.relay.key).toBeUndefined();
    });

    it("returns 429 when rate limit of 30 req/min is exceeded", async () => {
      const ip = "198.51.100.42";
      for (let i = 0; i < 30; i++) {
        const req = new Request("http://localhost/api/relay/attach?code=123456", {
          headers: { "x-forwarded-for": ip },
        });
        const res = await getAttach(req);
        expect(res.status).toBe(200);
      }

      const overLimitReq = new Request("http://localhost/api/relay/attach?code=123456", {
        headers: { "x-forwarded-for": ip },
      });
      const overRes = await getAttach(overLimitReq);
      expect(overRes.status).toBe(429);
      const overData = await overRes.json();
      expect(overData.error).toBe("Too many requests");
    });
  });

  describe("GET /api/relay/file", () => {
    it("returns 404 for unknown fileId or out of bounds index", async () => {
      const roomCode = "333444";
      await signalStore.createRoom(roomCode);
      const room = await signalStore.getRoom(roomCode, "code");
      if (room) {
        await signalStore.updateRoom(room.roomId, (r) => {
          r.relay = {
            salt: "c2FsdA==",
            createdAt: Date.now(),
            rid: validRid,
            baseUrl: validBaseUrl,
            files: [
              {
                id: validFileId,
                name: "file.bin",
                size: 100,
                mimeType: "application/octet-stream",
                chunkCount: 1, // Only index 0 is valid
                ivPrefix: "AAAAAA==",
              },
            ],
            items: [],
          };
          return r;
        });
      }

      // Unknown fileId
      const reqUnknownFile = new Request(`http://localhost/api/relay/file?code=${roomCode}&f=fedcba9876543210&i=0`);
      const res1 = await getFile(reqUnknownFile);
      expect(res1.status).toBe(404);

      // Out-of-bounds index (chunkCount is 1, index 1 is out of bounds)
      const reqOutOfBounds = new Request(`http://localhost/api/relay/file?code=${roomCode}&f=${validFileId}&i=1`);
      const res2 = await getFile(reqOutOfBounds);
      expect(res2.status).toBe(404);
    });

    it("never calls fetch with a query URL and constructs canonical chunk path", async () => {
      const roomCode = "555666";
      await signalStore.createRoom(roomCode);
      const room = await signalStore.getRoom(roomCode, "code");
      if (room) {
        await signalStore.updateRoom(room.roomId, (r) => {
          r.relay = {
            salt: "c2FsdA==",
            createdAt: Date.now(),
            rid: validRid,
            baseUrl: validBaseUrl,
            files: [
              {
                id: validFileId,
                name: "file.bin",
                size: 100,
                mimeType: "application/octet-stream",
                chunkCount: 2,
                ivPrefix: "AAAAAA==",
              },
            ],
            items: [],
          };
          return r;
        });
      }

      // Mock global fetch for upstream storage streaming
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { "content-length": "4" },
        })
      );
      global.fetch = fetchSpy;

      try {
        // Attacker attempts SSRF by passing a query parameter with a URL
        const req = new Request(
          `http://localhost/api/relay/file?code=${roomCode}&f=${validFileId}&i=0&url=https://evil.com/leak`
        );
        const res = await getFile(req);
        expect(res.status).toBe(200);

        // Verify signedReadUrl was called with the canonical chunk path
        const expectedChunkPath = `relay/${roomCode}/${validRid}/${validFileId}-0.bin`;
        expect(mockSignedReadUrl).toHaveBeenCalledWith(expectedChunkPath, { expiresIn: "5m" });

        // Verify fetch was called with the presigned URL, NEVER the query url
        expect(fetchSpy).toHaveBeenCalled();
        const calledUrl = fetchSpy.mock.calls[0][0];
        expect(calledUrl).toContain(expectedChunkPath);
        expect(calledUrl).not.toContain("evil.com");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("POST /api/relay/complete", () => {
    it("deletes exactly the manifest paths and leftover prefix", async () => {
      const roomCode = "777888";
      await signalStore.createRoom(roomCode);
      const room = await signalStore.getRoom(roomCode, "code");
      if (room) {
        await signalStore.updateRoom(room.roomId, (r) => {
          r.relay = {
            salt: "c2FsdA==",
            createdAt: Date.now(),
            rid: validRid,
            baseUrl: validBaseUrl,
            files: [
              {
                id: validFileId,
                name: "document.pdf",
                size: 5 * 1024 * 1024,
                mimeType: "application/pdf",
                chunkCount: 2, // 2 chunks: index 0 and index 1
                ivPrefix: "AAAAAA==",
              },
            ],
            items: [],
          };
          return r;
        });
      }

      const req = new Request("http://localhost/api/relay/complete", {
        method: "POST",
        body: JSON.stringify({ roomCode }),
      });

      const res = await postComplete(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(2);

      // Verify bucket.del was called with exactly the 2 chunk paths
      expect(mockDel).toHaveBeenCalledTimes(1);
      expect(mockDel).toHaveBeenCalledWith([
        `relay/${roomCode}/${validRid}/${validFileId}-0.bin`,
        `relay/${roomCode}/${validRid}/${validFileId}-1.bin`,
      ]);

      // Verify list was called for leftover prefix
      expect(mockList).toHaveBeenCalledWith({
        prefix: `relay/${roomCode}/${validRid}/`,
        limit: 100,
        cursor: undefined,
      });

      // Verify room relay was deleted
      const updated = await signalStore.getRoom(roomCode, "code");
      expect(updated?.relay).toBeUndefined();

      // Idempotent test
      const req2 = new Request("http://localhost/api/relay/complete", {
        method: "POST",
        body: JSON.stringify({ roomCode }),
      });
      const res2 = await postComplete(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.deleted).toBe(0);
    });

    it("returns deleted: 0 for non-existent room", async () => {
      const req = new Request("http://localhost/api/relay/complete", {
        method: "POST",
        body: JSON.stringify({ roomCode: "000000" }),
      });
      const res = await postComplete(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(0);
      expect(mockDel).not.toHaveBeenCalled();
    });
  });
});
