import { NextResponse } from "next/server";

export interface DiscoveredPeer {
  id: string;
  name: string;
  formFactor: "desktop" | "laptop" | "mobile" | "tablet";
  peerId: string;
  lastSeen: number;
}

// In-memory discovery store per network subnet
const networkPeers = new Map<string, Map<string, DiscoveredPeer>>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function computeNetworkId(ip: string): string {
  // Simple deterministic hash of IP string
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = (hash << 5) - hash + ip.charCodeAt(i);
    hash |= 0;
  }
  return `lan_${Math.abs(hash).toString(36)}`;
}

function pruneStalePeers(peers: Map<string, DiscoveredPeer>, ttlMs = 12000): DiscoveredPeer[] {
  const now = Date.now();
  const active: DiscoveredPeer[] = [];
  for (const [id, peer] of peers.entries()) {
    if (now - peer.lastSeen > ttlMs) {
      peers.delete(id);
    } else {
      active.push(peer);
    }
  }
  return active;
}

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const networkId = computeNetworkId(ip);

    let peersMap = networkPeers.get(networkId);
    if (!peersMap) {
      peersMap = new Map();
      networkPeers.set(networkId, peersMap);
    }

    const activePeers = pruneStalePeers(peersMap);

    return NextResponse.json({
      success: true,
      networkId,
      peers: activePeers,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const defaultNetworkId = computeNetworkId(ip);
    const body = await request.json();
    const { action, deviceId, name, formFactor, peerId, networkId: customNetworkId } = body;

    const targetNetworkId = customNetworkId || defaultNetworkId;

    let peersMap = networkPeers.get(targetNetworkId);
    if (!peersMap) {
      peersMap = new Map();
      networkPeers.set(targetNetworkId, peersMap);
    }

    if (action === "announce") {
      if (!deviceId) {
        return NextResponse.json({ success: false, error: "deviceId required" }, { status: 400 });
      }

      peersMap.set(deviceId, {
        id: deviceId,
        name: name || "Anonymous Peer",
        formFactor: formFactor || "laptop",
        peerId: peerId || deviceId,
        lastSeen: Date.now(),
      });

      const activePeers = pruneStalePeers(peersMap);
      // Return other peers excluding the caller
      const otherPeers = activePeers.filter((p) => p.id !== deviceId);

      return NextResponse.json({
        success: true,
        networkId: targetNetworkId,
        peers: otherPeers,
      });
    }

    if (action === "leave") {
      if (deviceId) {
        peersMap.delete(deviceId);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
