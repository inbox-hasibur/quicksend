import { NextResponse } from "next/server";
import { PUBLIC_STUN_SERVERS, getTurnServers } from "@/lib/iceConfig";

interface CachedCredentials {
  servers: RTCIceServer[];
  expiresAt: number;
}

let serverTurnCache: CachedCredentials | null = null;

/**
 * Resets the in-memory TURN cache. Exported for automated unit testing.
 */
export function _resetTurnCacheForTest() {
  serverTurnCache = null;
}

export async function GET() {
  const meteredDomain = process.env.METERED_TURN_DOMAIN?.trim();
  const meteredApiKey = process.env.METERED_TURN_API_KEY?.trim();

  let dynamicTurnServers: RTCIceServer[] = [];

  if (meteredDomain && meteredApiKey) {
    if (serverTurnCache && Date.now() < serverTurnCache.expiresAt) {
      dynamicTurnServers = serverTurnCache.servers;
    } else {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const url = `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredApiKey}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.iceServers;
          if (Array.isArray(list)) {
            dynamicTurnServers = list;
            serverTurnCache = {
              servers: dynamicTurnServers,
              expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes cache
            };
          }
        }
      } catch (err) {
        // Fallback gracefully without throwing 500, never exposing secret API key to client
        console.warn(
          "[TURN] Failed to fetch Metered TURN credentials:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  const staticTurnServers = getTurnServers();

  const combinedIceServers: RTCIceServer[] = [
    ...PUBLIC_STUN_SERVERS,
    ...staticTurnServers,
    ...dynamicTurnServers,
  ];

  const hasTurn = combinedIceServers.some((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some(
      (u) => typeof u === "string" && (u.startsWith("turn:") || u.startsWith("turns:"))
    );
  });

  return NextResponse.json(
    {
      iceServers: combinedIceServers,
      hasTurn,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    }
  );
}
