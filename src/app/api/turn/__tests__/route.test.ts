import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, _resetTurnCacheForTest } from "@/app/api/turn/route";

describe("GET /api/turn Route Handler", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    _resetTurnCacheForTest();
    delete process.env.METERED_TURN_DOMAIN;
    delete process.env.METERED_TURN_API_KEY;
    delete process.env.NEXT_PUBLIC_TURN_URL;
    delete process.env.NEXT_PUBLIC_TURN_USERNAME;
    delete process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should return public STUN servers and hasTurn: false by default", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasTurn).toBe(false);
    expect(Array.isArray(body.iceServers)).toBe(true);
    expect(body.iceServers.length).toBeGreaterThan(0);

    const urls = body.iceServers[0].urls as string[];
    expect(urls.some((u: string) => u.includes("google"))).toBe(true);
  });

  it("should fetch ephemeral credentials from Metered when domain and API key are set", async () => {
    process.env.METERED_TURN_DOMAIN = "quicksend-test.metered.ca";
    process.env.METERED_TURN_API_KEY = "secret_api_key_12345";

    const mockMeteredServers = [
      { urls: "stun:relay.metered.ca:80" },
      {
        urls: ["turn:relay.metered.ca:443", "turns:relay.metered.ca:5349"],
        username: "ephemeral-user-abc",
        credential: "ephemeral-cred-xyz",
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMeteredServers,
    });
    globalThis.fetch = fetchMock;

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasTurn).toBe(true);

    // Verify fetch was called with domain and api key
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("https://quicksend-test.metered.ca/api/v1/turn/credentials");
    expect(calledUrl).toContain("apiKey=secret_api_key_12345");

    // Verify client response includes TURN credentials without exposing the API key
    expect(JSON.stringify(body)).not.toContain("secret_api_key_12345");
    expect(JSON.stringify(body)).toContain("ephemeral-user-abc");
    expect(JSON.stringify(body)).toContain("ephemeral-cred-xyz");

    // Verify in-memory cache: second call does not re-fetch
    const res2 = await GET();
    expect(res2.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should fall back gracefully to STUN servers if Metered fetch fails", async () => {
    process.env.METERED_TURN_DOMAIN = "quicksend-test.metered.ca";
    process.env.METERED_TURN_API_KEY = "secret_api_key_12345";

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasTurn).toBe(false);
    expect(body.iceServers.length).toBeGreaterThan(0);
  });

  it("should include static TURN servers when NEXT_PUBLIC_TURN_URL is set", async () => {
    process.env.NEXT_PUBLIC_TURN_URL = "turn:static-relay.example.com:3478";
    process.env.NEXT_PUBLIC_TURN_USERNAME = "static-user";
    process.env.NEXT_PUBLIC_TURN_CREDENTIAL = "static-pass";

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasTurn).toBe(true);

    const turnServer = body.iceServers.find((s: RTCIceServer) =>
      Array.isArray(s.urls)
        ? s.urls.some((u) => u.includes("static-relay.example.com"))
        : (s.urls as string).includes("static-relay.example.com")
    );
    expect(turnServer).toBeDefined();
    expect(turnServer?.username).toBe("static-user");
  });
});
