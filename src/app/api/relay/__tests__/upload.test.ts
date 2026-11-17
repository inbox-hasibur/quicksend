import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../upload/route";
import { signalStore } from "@/lib/signalStore";

let capturedTokenOptions: Record<string, unknown> | null = null;

vi.mock("@vercel/blob/client", () => ({
  handleUpload: vi.fn(async (opts) => {
    const res = await opts.onBeforeGenerateToken(
      opts.body.payload.pathname,
      opts.body.payload.clientPayload,
      opts.body.payload.multipart
    );
    capturedTokenOptions = res;
    return {
      type: "blob.generate-client-token",
      clientToken: "mocked_client_token",
    };
  }),
}));

describe("POST /api/relay/upload", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedTokenOptions = null;
    await signalStore.clear?.();
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    } else {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });

  it("returns 503 when BLOB_READ_WRITE_TOKEN is missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const req = new Request("http://localhost/api/relay/upload", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Relay not configured");
  });

  it("returns client token with exact options (application/octet-stream, size plus 16, random suffix)", async () => {
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
    expect(data.clientToken).toBe("mocked_client_token");

    expect(capturedTokenOptions).toBeDefined();
    expect(capturedTokenOptions?.allowedContentTypes).toEqual(["application/octet-stream"]);
    expect(capturedTokenOptions?.maximumSizeInBytes).toBe(size + 16);
    expect(capturedTokenOptions?.addRandomSuffix).toBe(true);
    expect(typeof capturedTokenOptions?.validUntil).toBe("number");
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
