import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../upload/route";
import { signalStore } from "@/lib/signalStore";
import { RELAY_CHUNK_BYTES } from "@/lib/relayLimits";

let capturedSignedUploadOptions: Record<string, unknown>[] = [];
const mockSignedUploadUrl = vi.fn(async (pathname: string, opts: Record<string, unknown>) => {
  capturedSignedUploadOptions.push({ pathname, ...opts });
  return {
    url: `https://my-bucket.blob.upstash.io/${pathname}?token=mock_sig`,
    headers: { "content-type": "application/octet-stream" },
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
});
const mockPublicUrl = vi.fn(async (pathname: string) => `https://my-bucket.blob.upstash.io/${pathname}`);

vi.mock("@upstash/blob", () => ({
  Bucket: class MockBucket {
    signedUploadUrl(...args: [string, Record<string, unknown>]) {
      return mockSignedUploadUrl(...args);
    }
    publicUrl(...args: [string]) {
      return mockPublicUrl(...args);
    }
  },
}));

describe("POST /api/relay/upload (Chunked Relay)", () => {
  const originalUrl = process.env.UPSTASH_BLOB_URL;
  const originalToken = process.env.UPSTASH_BLOB_TOKEN;
  const originalDaily = process.env.RELAY_DAILY_BYTES;

  const validRoomCode = "128745";
  const validRid = "0123456789abcdef0123456789abcdef";
  const validFileId = "0123456789abcdef";

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedSignedUploadOptions = [];
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

    if (originalDaily !== undefined) {
      process.env.RELAY_DAILY_BYTES = originalDaily;
    } else {
      delete process.env.RELAY_DAILY_BYTES;
    }
  });

  it("returns 503 when UPSTASH_BLOB_TOKEN is missing", async () => {
    delete process.env.UPSTASH_BLOB_TOKEN;

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      body: JSON.stringify({
        roomCode: validRoomCode,
        rid: validRid,
        chunks: [{ path: `relay/${validRoomCode}/${validRid}/${validFileId}-0.bin`, size: 1024 }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Relay not configured");
  });

  it("accepts a valid batch of chunks and returns signed URLs", async () => {
    const chunk0 = { path: `relay/${validRoomCode}/${validRid}/${validFileId}-0.bin`, size: 1048576 };
    const chunk1 = { path: `relay/${validRoomCode}/${validRid}/${validFileId}-1.bin`, size: 524288 };

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({
        roomCode: validRoomCode,
        rid: validRid,
        chunks: [chunk0, chunk1],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.urls)).toBe(true);
    expect(data.urls.length).toBe(2);
    expect(data.urls[0].path).toBe(chunk0.path);
    expect(data.urls[0].url).toContain(chunk0.path);
    expect(data.urls[1].path).toBe(chunk1.path);

    expect(capturedSignedUploadOptions.length).toBe(2);
    expect(capturedSignedUploadOptions[0].contentType).toBe("application/octet-stream");
    expect(capturedSignedUploadOptions[0].size).toBe(chunk0.size);
    expect(capturedSignedUploadOptions[0].expiresIn).toBe("10m");
  });

  it("rejects bad chunk path", async () => {
    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({
        roomCode: validRoomCode,
        rid: validRid,
        chunks: [{ path: "relay/unauthorized/path.bin", size: 1024 }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid chunk path");
  });

  it("rejects bad rid", async () => {
    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      body: JSON.stringify({
        roomCode: validRoomCode,
        rid: "short_rid",
        chunks: [{ path: `relay/${validRoomCode}/${validRid}/${validFileId}-0.bin`, size: 1024 }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid rid");
  });

  it("rejects oversized chunk (> RELAY_CHUNK_BYTES + 16)", async () => {
    const oversized = RELAY_CHUNK_BYTES + 17;
    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      body: JSON.stringify({
        roomCode: validRoomCode,
        rid: validRid,
        chunks: [{ path: `relay/${validRoomCode}/${validRid}/${validFileId}-0.bin`, size: oversized }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid chunk size");
  });

  it("rejects request with 65 chunks", async () => {
    const chunks = [];
    for (let i = 0; i < 65; i++) {
      chunks.push({
        path: `relay/${validRoomCode}/${validRid}/${validFileId}-${i % 50}.bin`,
        size: 1024,
      });
    }

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      body: JSON.stringify({
        roomCode: validRoomCode,
        rid: validRid,
        chunks,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Too many chunks in request");
  });

  it("rejects request when hourly byte limit (600 MB) is exceeded", async () => {
    const ip = "192.168.1.55";
    // Pre-fill byte limit
    await signalStore.setKey(`ratelimit:relay:upload-bytes:${ip}`, String(600 * 1024 * 1024), 3600);

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify({
        roomCode: validRoomCode,
        rid: validRid,
        chunks: [{ path: `relay/${validRoomCode}/${validRid}/${validFileId}-0.bin`, size: 1024 }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("Upload byte limit exceeded");
  });

  it("rejects request when daily budget limit is exceeded", async () => {
    process.env.RELAY_DAILY_BYTES = "1000";
    const today = new Date().toISOString().slice(0, 10);
    await signalStore.setKey(`relay-bytes:${today}`, "900", 86400);

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.99" },
      body: JSON.stringify({
        roomCode: validRoomCode,
        rid: validRid,
        chunks: [{ path: `relay/${validRoomCode}/${validRid}/${validFileId}-0.bin`, size: 200 }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("Relay daily limit reached");
  });
});
