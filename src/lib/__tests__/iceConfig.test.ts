import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PUBLIC_STUN_SERVERS,
  getTurnServers,
  getRtcConfig,
  fetchIceConfig,
  _resetDynamicIceCacheForTest,
  ICE_CONNECTION_TIMEOUT_MS,
  FIREWALL_FALLBACK_MESSAGE,
} from "@/lib/iceConfig";

describe("ICE & WebRTC Configuration", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    _resetDynamicIceCacheForTest();
    delete process.env.NEXT_PUBLIC_TURN_URL;
    delete process.env.NEXT_PUBLIC_TURN_USERNAME;
    delete process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should contain Google and Cloudflare public STUN servers", () => {
    expect(PUBLIC_STUN_SERVERS.length).toBeGreaterThan(0);
    const urls = PUBLIC_STUN_SERVERS[0].urls as string[];
    expect(urls.some((u) => u.includes("google"))).toBe(true);
    expect(urls.some((u) => u.includes("cloudflare"))).toBe(true);
  });

  it("should return empty TURN servers when env vars are not set", () => {
    const turn = getTurnServers();
    expect(turn).toEqual([]);
  });

  it("should parse and inject TURN server from environment variables", () => {
    process.env.NEXT_PUBLIC_TURN_URL = "turn:turn.quicksend.app:3478?transport=udp";
    process.env.NEXT_PUBLIC_TURN_USERNAME = "relay-user";
    process.env.NEXT_PUBLIC_TURN_CREDENTIAL = "relay-secret-pass";

    const turn = getTurnServers();
    expect(turn.length).toBe(1);
    expect(turn[0].urls).toEqual(["turn:turn.quicksend.app:3478?transport=udp"]);
    expect(turn[0].username).toBe("relay-user");
    expect(turn[0].credential).toBe("relay-secret-pass");
  });

  it("should parse multiple comma-separated TURN URLs", () => {
    process.env.NEXT_PUBLIC_TURN_URL =
      "turn:turn1.example.com:3478, turns:turn2.example.com:5349";

    const turn = getTurnServers();
    expect(turn.length).toBe(1);
    expect(turn[0].urls).toEqual([
      "turn:turn1.example.com:3478",
      "turns:turn2.example.com:5349",
    ]);
  });

  it("should return empty iceServers for Hotspot and Camera offline modes", () => {
    const hotspotConfig = getRtcConfig("hotspot");
    expect(hotspotConfig.iceServers).toEqual([]);
    expect(hotspotConfig.iceCandidatePoolSize).toBe(0);

    const cameraConfig = getRtcConfig("camera");
    expect(cameraConfig.iceServers).toEqual([]);
    expect(cameraConfig.iceCandidatePoolSize).toBe(0);
  });

  it("should return STUN pool for Same Wi-Fi and Internet modes for NAT & mDNS resilience", () => {
    const sameNetConfig = getRtcConfig("same-network");
    expect(sameNetConfig.iceServers?.length).toBeGreaterThan(0);

    const internetConfig = getRtcConfig("internet");
    expect(internetConfig.iceServers?.length).toBeGreaterThan(0);
    expect(internetConfig.iceCandidatePoolSize).toBe(10);
  });

  it("should export standard 30-second ICE timeout and fallback message", () => {
    expect(ICE_CONNECTION_TIMEOUT_MS).toBe(30000);
    expect(FIREWALL_FALLBACK_MESSAGE).toContain("firewall");
    expect(FIREWALL_FALLBACK_MESSAGE).toContain("Mode 2");
    expect(FIREWALL_FALLBACK_MESSAGE).toContain("Mode 3");
  });

  describe("fetchIceConfig", () => {
    it("should return empty iceServers for camera and hotspot modes without network calls", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const cam = await fetchIceConfig("camera");
      expect(cam.iceServers).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();

      const hot = await fetchIceConfig("hotspot");
      expect(hot.iceServers).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should fetch dynamic ICE servers from /api/turn for internet mode", async () => {
      const mockDynamicServers: RTCIceServer[] = [
        { urls: "turn:relay.quicksend.app:443", username: "dyn-user", credential: "dyn-pass" },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ iceServers: mockDynamicServers, hasTurn: true }),
      });
      globalThis.fetch = fetchMock;

      const config = await fetchIceConfig("internet");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/turn");
      expect(config.iceServers).toEqual(mockDynamicServers);
      expect(config.iceCandidatePoolSize).toBe(10);

      // Verify client cache prevents redundant fetch on immediate second call
      const cached = await fetchIceConfig("internet");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cached.iceServers).toEqual(mockDynamicServers);
    });

    it("should fetch dynamic ICE servers from /api/turn for same-network mode", async () => {
      const mockDynamicServers: RTCIceServer[] = [
        { urls: "turn:relay.quicksend.app:443", username: "dyn-user", credential: "dyn-pass" },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ iceServers: mockDynamicServers, hasTurn: true }),
      });
      globalThis.fetch = fetchMock;

      const config = await fetchIceConfig("same-network");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/turn");
      expect(config.iceServers).toEqual(mockDynamicServers);
      expect(config.iceCandidatePoolSize).toBe(10);
    });

    it("should fall back safely to getRtcConfig when /api/turn fetch fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Fetch failed"));

      const config = await fetchIceConfig("internet");
      expect(config.iceServers?.length).toBeGreaterThan(0);
      const urls = config.iceServers?.[0].urls as string[];
      expect(urls.some((u) => u.includes("google"))).toBe(true);
    });
  });
});
