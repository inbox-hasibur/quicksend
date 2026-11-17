import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as getStatus } from "../status/route";
import { GET as getAttach, POST as postAttach } from "../attach/route";
import { POST as postComplete } from "../complete/route";
import { signalStore } from "@/lib/signalStore";

const mockDel = vi.fn().mockResolvedValue(undefined);

vi.mock("@upstash/blob", () => ({
  Bucket: class MockBucket {
    async del(...args: unknown[]) {
      return mockDel(...args);
    }
  },
}));

describe("Relay API Routes (@upstash/blob)", () => {
  const originalUrl = process.env.UPSTASH_BLOB_URL;
  const originalToken = process.env.UPSTASH_BLOB_TOKEN;

  beforeEach(async () => {
    vi.clearAllMocks();
    await signalStore.clear?.();
    process.env.UPSTASH_BLOB_URL = "https://my-bucket.blob.upstash.io";
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
    it("returns available: false when UPSTASH_BLOB_TOKEN or UPSTASH_BLOB_URL is unset", async () => {
      delete process.env.UPSTASH_BLOB_TOKEN;
      const res = await getStatus();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.maxFileBytes).toBe(52428800);
      expect(data.maxFiles).toBe(5);
      expect(data.ttlMinutes).toBe(15);
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
    it("rejects foreign storage host", async () => {
      const req = new Request("http://localhost/api/relay/attach", {
        method: "POST",
        body: JSON.stringify({
          roomCode: "123456",
          salt: "c2FsdF9leGFtcGxlXzE2",
          items: [
            {
              url: "https://evil.com/relay/123456/test.enc",
              pathname: "/relay/123456/test.enc",
              name: "test.txt",
              size: 100,
              mimeType: "text/plain",
              iv: "aXZfZXhhbXBsZQ==",
            },
          ],
        }),
      });

      const res = await postAttach(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Forbidden storage host/i);
    });

    it("rejects wrong blob pathname not starting with room code prefix", async () => {
      const req = new Request("http://localhost/api/relay/attach", {
        method: "POST",
        body: JSON.stringify({
          roomCode: "123456",
          salt: "c2FsdF9leGFtcGxlXzE2",
          items: [
            {
              url: "https://my-bucket.blob.upstash.io/other/path/test.enc",
              pathname: "/other/path/test.enc",
              name: "test.txt",
              size: 100,
              mimeType: "text/plain",
              iv: "aXZfZXhhbXBsZQ==",
            },
          ],
        }),
      });

      const res = await postAttach(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Forbidden storage host/i);
    });

    it("creates a missing room and stores relay data", async () => {
      const roomCode = "654321";
      const validUrl = `https://my-bucket.blob.upstash.io/relay/${roomCode}/file.enc`;
      const validPath = `/relay/${roomCode}/file.enc`;

      const req = new Request("http://localhost/api/relay/attach", {
        method: "POST",
        body: JSON.stringify({
          roomCode,
          salt: "c2FsdF9leGFtcGxlXzE2",
          items: [
            {
              url: validUrl,
              pathname: validPath,
              name: "document.pdf",
              size: 1024,
              mimeType: "application/pdf",
              iv: "aXZfZXhhbXBsZQ==",
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

      // Verify room was created in store
      const storedRoom = await signalStore.getRoom(roomCode, "code");
      expect(storedRoom).not.toBeNull();
      expect(storedRoom?.relay?.items[0].url).toBe(validUrl);
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

    it("returns 429 when rate limit of 30 req/min is exceeded", async () => {
      const ip = "198.51.100.42";
      for (let i = 0; i < 30; i++) {
        const req = new Request("http://localhost/api/relay/attach?code=123456", {
          headers: { "x-forwarded-for": ip },
        });
        const res = await getAttach(req);
        expect(res.status).toBe(200);
      }

      // 31st request hits 429
      const overLimitReq = new Request("http://localhost/api/relay/attach?code=123456", {
        headers: { "x-forwarded-for": ip },
      });
      const overRes = await getAttach(overLimitReq);
      expect(overRes.status).toBe(429);
      const overData = await overRes.json();
      expect(overData.error).toBe("Too many requests");
    });
  });

  describe("POST /api/relay/complete", () => {
    it("calls del() with stored URLs/paths only and ignores request body URLs", async () => {
      const roomCode = "777888";
      const storedUrl = `https://my-bucket.blob.upstash.io/relay/${roomCode}/secret.enc`;

      // Pre-seed room with relay
      await signalStore.createRoom(roomCode);
      const room = await signalStore.getRoom(roomCode, "code");
      if (room) {
        await signalStore.updateRoom(room.roomId, (r) => {
          r.relay = {
            salt: "c2FsdA==",
            createdAt: Date.now(),
            items: [
              {
                url: storedUrl,
                pathname: `/relay/${roomCode}/secret.enc`,
                name: "secret.bin",
                size: 500,
                mimeType: "application/octet-stream",
                iv: "aXY=",
              },
            ],
          };
          return r;
        });
      }

      // Try to pass malicious URL in body
      const req = new Request("http://localhost/api/relay/complete", {
        method: "POST",
        body: JSON.stringify({
          roomCode,
          urls: ["https://my-bucket.blob.upstash.io/malicious/target.enc"],
        }),
      });

      const res = await postComplete(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(1);

      // Verify del was called ONLY with stored path
      expect(mockDel).toHaveBeenCalledTimes(1);
      expect(mockDel).toHaveBeenCalledWith(`relay/${roomCode}/secret.enc`);

      // Verify room relay was cleared in store
      const updatedRoom = await signalStore.getRoom(roomCode, "code");
      expect(updatedRoom?.relay).toBeUndefined();

      // Idempotent test: calling complete again returns { deleted: 0 }
      const req2 = new Request("http://localhost/api/relay/complete", {
        method: "POST",
        body: JSON.stringify({ roomCode }),
      });
      const res2 = await postComplete(req2);
      const data2 = await res2.json();
      expect(data2.deleted).toBe(0);
      expect(mockDel).toHaveBeenCalledTimes(1); // Not called again
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
