import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PUBLIC_STUN_SERVERS,
  getTurnServers,
  getRtcConfig,
  ICE_CONNECTION_TIMEOUT_MS,
  FIREWALL_FALLBACK_MESSAGE,
} from "@/lib/iceConfig";

describe("ICE & WebRTC Configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_TURN_URL;
    delete process.env.NEXT_PUBLIC_TURN_USERNAME;
    delete process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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

  it("should return empty iceServers for Same Wi-Fi, Hotspot, and Camera modes to prioritize local host candidates", () => {
    const sameNetConfig = getRtcConfig("same-network");
    expect(sameNetConfig.iceServers).toEqual([]);
    expect(sameNetConfig.iceCandidatePoolSize).toBe(0);

    const hotspotConfig = getRtcConfig("hotspot");
    expect(hotspotConfig.iceServers).toEqual([]);
    expect(hotspotConfig.iceCandidatePoolSize).toBe(0);

    const cameraConfig = getRtcConfig("camera");
    expect(cameraConfig.iceServers).toEqual([]);
    expect(cameraConfig.iceCandidatePoolSize).toBe(0);
  });

  it("should return STUN pool and candidate pool size for Internet mode", () => {
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
});
