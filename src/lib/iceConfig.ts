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
      "stun:global.stun.twilio.com:3478",
    ],
  },
];

/**
 * Optional default TURN relay servers pool.
 * Kept empty by default to prevent non-routable blackholes (such as defunct openrelay endpoints).
 */
const PUBLIC_TURN_SERVERS: RTCIceServer[] = [];

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
 * - Same Wi-Fi: Includes public STUN pool + community TURN fallback so reflexive & relayed candidates
 *   resolve across mobile/desktop even if mDNS obfuscation, AP isolation, or Windows Firewall interferes.
 * - Offline Camera / Offline Hotspot: Empty iceServers to prevent external DNS stalls in air-gapped setups.
 * - Internet: Full multi-provider STUN pool + TURN relay pool.
 */
export function getRtcConfig(mode: TransferMode = "internet"): RTCConfiguration {
  if (mode === "camera" || mode === "hotspot") {
    return {
      iceServers: [],
      iceCandidatePoolSize: 0,
    };
  }

  const customTurn = getTurnServers();
  const effectiveTurn = customTurn.length > 0 ? customTurn : PUBLIC_TURN_SERVERS;

  return {
    iceServers: [...PUBLIC_STUN_SERVERS, ...effectiveTurn],
    iceCandidatePoolSize: 10,
  };
}

export const ICE_CONNECTION_TIMEOUT_MS = 30000;

export const FIREWALL_FALLBACK_MESSAGE =
  "Direct P2P connection timed out or blocked by restrictive firewall/symmetric NAT. Ensure both devices are online, or try Mode 2 (Same Wi-Fi) or Mode 3 (Hotspot) for direct transfer.";
