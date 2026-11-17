import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../cleanup/route";

const mockList = vi.fn();
const mockDel = vi.fn();

vi.mock("@upstash/blob", () => ({
  Bucket: class MockBucket {
    list(...args: unknown[]) {
      return mockList(...args);
    }
    del(...args: unknown[]) {
      return mockDel(...args);
    }
  },
}));

describe("GET /api/relay/cleanup (@upstash/blob)", () => {
  const originalUrl = process.env.UPSTASH_BLOB_URL;
  const originalToken = process.env.UPSTASH_BLOB_TOKEN;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_BLOB_URL = "https://my-bucket.blob.upstash.io";
    process.env.UPSTASH_BLOB_TOKEN = "upstash_token_mock";
    delete process.env.CRON_SECRET;
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

    if (originalCronSecret !== undefined) {
      process.env.CRON_SECRET = originalCronSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it("returns {scanned: 0, deleted: 0} when UPSTASH_BLOB_TOKEN or UPSTASH_BLOB_URL is missing", async () => {
    delete process.env.UPSTASH_BLOB_TOKEN;

    const req = new Request("http://localhost/api/relay/cleanup");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ scanned: 0, deleted: 0 });
    expect(mockList).not.toHaveBeenCalled();
  });

  it("requires bearer secret when CRON_SECRET is configured", async () => {
    process.env.CRON_SECRET = "super_secret_cron_key";

    // Request without auth header
    const reqNoAuth = new Request("http://localhost/api/relay/cleanup");
    const resNoAuth = await GET(reqNoAuth);
    expect(resNoAuth.status).toBe(401);

    // Request with wrong bearer
    const reqWrongAuth = new Request("http://localhost/api/relay/cleanup", {
      headers: { authorization: "Bearer wrong_key" },
    });
    const resWrongAuth = await GET(reqWrongAuth);
    expect(resWrongAuth.status).toBe(401);

    // Request with correct bearer
    mockList.mockResolvedValueOnce({ blobs: [], cursor: undefined });
    const reqCorrect = new Request("http://localhost/api/relay/cleanup", {
      headers: { authorization: "Bearer super_secret_cron_key" },
    });
    const resCorrect = await GET(reqCorrect);
    expect(resCorrect.status).toBe(200);
    expect(mockList).toHaveBeenCalled();
  });

  it("deletes only blobs older than 30 minutes", async () => {
    const now = Date.now();
    const staleTime = new Date(now - 35 * 60 * 1000); // 35 min ago (stale)
    const freshTime = new Date(now - 10 * 60 * 1000); // 10 min ago (fresh)

    mockList.mockResolvedValueOnce({
      blobs: [
        {
          path: "relay/room1/old.enc",
          url: "https://my-bucket.blob.upstash.io/relay/room1/old.enc",
          size: 100,
          etag: "etag1",
          uploadedAt: staleTime,
        },
        {
          path: "relay/room2/fresh.enc",
          url: "https://my-bucket.blob.upstash.io/relay/room2/fresh.enc",
          size: 200,
          etag: "etag2",
          uploadedAt: freshTime,
        },
      ],
      cursor: undefined,
    });

    const req = new Request("http://localhost/api/relay/cleanup");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toEqual({ scanned: 2, deleted: 1 });
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith("relay/room1/old.enc");
  });
});
