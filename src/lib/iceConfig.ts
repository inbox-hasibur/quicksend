import type { TransferMode } from "@/types/mode";

/**
 * Multi-provider public STUN server pool (Google + Cloudflare).
 * Zero-cost, high-availability public infrastructure for NAT traversal.
 */
export const PUBLIC_STUN_SERVERS: RTCIceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
      "stun:stun.services.mozilla.com",
    ],
  },
];

/**
 * Extracts optional TURN server configuration from environment variables if present.
 * Accepts comma-separated URLs via NEXT_PUBLIC_TURN_URL.
 */
export function getTurnServers(): RTCIceServer[] {
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (!turnUrl) return [];

  const urls = turnUrl
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) return [];

  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  const server: RTCIceServer = { urls };
  if (username) server.username = username;
  if (credential) server.credential = credential;

  return [server];
}

/**
 * Returns optimized RTCConfiguration based on the active transfer mode.
 * - Same Wi-Fi / Hotspot: Local internal host candidate priority (empty iceServers prevents external DNS stalls).
 * - Internet: Full multi-provider STUN pool + optional TURN relay.
 */
export function getRtcConfig(mode: TransferMode = "internet"): RTCConfiguration {
  if (mode === "same-network" || mode === "hotspot" || mode === "camera") {
    return {
      iceServers: [],
      iceCandidatePoolSize: 0,
    };
  }

  return {
    iceServers: [...PUBLIC_STUN_SERVERS, ...getTurnServers()],
    iceCandidatePoolSize: 10,
  };
}

export const ICE_CONNECTION_TIMEOUT_MS = 30000;

export const FIREWALL_FALLBACK_MESSAGE =
  "Direct P2P connection timed out or blocked by restrictive firewall/symmetric NAT. Ensure both devices are online, or try Mode 2 (Same Wi-Fi) or Mode 3 (Hotspot) for direct transfer.";
