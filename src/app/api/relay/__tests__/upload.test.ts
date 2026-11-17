import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../upload/route";
import { signalStore } from "@/lib/signalStore";

let capturedSignedUploadOptions: Record<string, unknown> | null = null;
const mockSignedUploadUrl = vi.fn(async (pathname: string, opts: Record<string, unknown>) => {
  capturedSignedUploadOptions = { pathname, ...opts };
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

describe("POST /api/relay/upload (@upstash/blob)", () => {
  const originalUrl = process.env.UPSTASH_BLOB_URL;
  const originalToken = process.env.UPSTASH_BLOB_TOKEN;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedSignedUploadOptions = null;
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

  it("returns 503 when UPSTASH_BLOB_TOKEN or UPSTASH_BLOB_URL is missing", async () => {
    delete process.env.UPSTASH_BLOB_TOKEN;

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Relay not configured");
  });

  it("returns signed upload url with exact options (application/octet-stream, size plus 16)", async () => {
    const roomCode = "128745";
    const size = 1048576; // 1 MB
    const pathname = `relay/${roomCode}/file.enc`;

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname,
          clientPayload: JSON.stringify({ roomCode, size }),
          multipart: false,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain("https://my-bucket.blob.upstash.io/relay/128745/file.enc");

    expect(capturedSignedUploadOptions).toBeDefined();
    expect(capturedSignedUploadOptions?.contentType).toBe("application/octet-stream");
    expect(capturedSignedUploadOptions?.size).toBe(size + 16);
    expect(capturedSignedUploadOptions?.expiresIn).toBe("10m");
  });

  it("rejects bad pathname not matching pattern", async () => {
    const roomCode = "128745";
    const size = 1024;

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: "other/unauthorized/path.bin",
          clientPayload: JSON.stringify({ roomCode, size }),
          multipart: false,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid pathname");
  });

  it("rejects 7th request from one IP in an hour with 'Too many uploads'", async () => {
    const roomCode = "128745";
    const ip = "192.168.1.55";

    for (let i = 1; i <= 6; i++) {
      const req = new Request("http://localhost/api/relay/upload", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({
          type: "blob.generate-client-token",
          payload: {
            pathname: `relay/${roomCode}/file_${i}.enc`,
            clientPayload: JSON.stringify({ roomCode, size: 100 }),
            multipart: false,
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    // 7th request
    const overLimitReq = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: `relay/${roomCode}/file_7.enc`,
          clientPayload: JSON.stringify({ roomCode, size: 100 }),
          multipart: false,
        },
      }),
    });

    const overLimitRes = await POST(overLimitReq);
    expect(overLimitRes.status).toBe(400);
    const data = await overLimitRes.json();
    expect(data.error).toBe("Too many uploads");
  });

  it("rejects request when daily budget (600 MB) is exceeded", async () => {
    const roomCode = "128745";
    const today = new Date().toISOString().slice(0, 10);
    // Pre-fill daily budget close to limit (629145600 bytes)
    await signalStore.setKey(`relay-bytes:${today}`, String(629145000), 86400);

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.99" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: `relay/${roomCode}/file.enc`,
          clientPayload: JSON.stringify({ roomCode, size: 1000 }), // Exceeds 629145600
          multipart: false,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Relay daily limit reached");
  });
});
