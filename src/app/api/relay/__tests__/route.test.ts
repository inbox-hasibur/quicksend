import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as getStatus } from "../status/route";
import { GET as getAttach, POST as postAttach } from "../attach/route";
import { POST as postComplete } from "../complete/route";
import { signalStore } from "@/lib/signalStore";

const mockDel = vi.fn();
vi.mock("@vercel/blob", () => ({
  del: (...args: unknown[]) => mockDel(...args),
}));

describe("Relay API Routes", () => {
  const originalEnv = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(async () => {
    vi.clearAllMocks();
    await signalStore.clear?.();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BLOB_READ_WRITE_TOKEN = originalEnv;
    } else {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });

  describe("GET /api/relay/status", () => {
    it("returns available: false when BLOB_READ_WRITE_TOKEN is unset", async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;
      const res = await getStatus();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.maxFileBytes).toBe(52428800);
      expect(data.maxFiles).toBe(5);
      expect(data.ttlMinutes).toBe(15);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns available: true when BLOB_READ_WRITE_TOKEN is set", async () => {
      process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_token";
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
              url: "https://store.blob.vercel-storage.com/other/path/test.enc",
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
      expect(data.error).toMatch(/Invalid blob pathname/i);
    });

    it("creates a missing room and stores relay data", async () => {
      const roomCode = "654321";
      const validUrl = `https://my-store.blob.vercel-storage.com/relay/${roomCode}/file.enc`;
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
    it("calls del() with stored URLs only and ignores request body URLs", async () => {
      const roomCode = "777888";
      const storedUrl = `https://store.blob.vercel-storage.com/relay/${roomCode}/secret.enc`;

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
          urls: ["https://store.blob.vercel-storage.com/malicious/target.enc"],
        }),
      });

      const res = await postComplete(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(1);

      // Verify del was called ONLY with storedUrl
      expect(mockDel).toHaveBeenCalledTimes(1);
      expect(mockDel).toHaveBeenCalledWith([storedUrl]);

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
