import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../cleanup/route";

const mockList = vi.fn();
const mockDel = vi.fn();

vi.mock("@vercel/blob", () => ({
  list: (...args: unknown[]) => mockList(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

describe("GET /api/relay/cleanup", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    } else {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }

    if (originalCronSecret !== undefined) {
      process.env.CRON_SECRET = originalCronSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it("returns {scanned: 0, deleted: 0} when BLOB_READ_WRITE_TOKEN is missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

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
    mockList.mockResolvedValueOnce({ blobs: [], hasMore: false });
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
          url: "https://store.blob.vercel-storage.com/relay/room1/old.enc",
          pathname: "relay/room1/old.enc",
          uploadedAt: staleTime,
        },
        {
          url: "https://store.blob.vercel-storage.com/relay/room2/fresh.enc",
          pathname: "relay/room2/fresh.enc",
          uploadedAt: freshTime,
        },
      ],
      hasMore: false,
    });

    const req = new Request("http://localhost/api/relay/cleanup");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toEqual({ scanned: 2, deleted: 1 });
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith([
      "https://store.blob.vercel-storage.com/relay/room1/old.enc",
    ]);
  });
});
