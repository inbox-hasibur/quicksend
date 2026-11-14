import { NextResponse } from "next/server";
import { AVATAR_PRESETS } from "@/lib/deviceIdentity";
import { isRedisConfigured } from "@/lib/signalStore";

export interface DiscoveredPeer {
  id: string;
  name: string;
  codename?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  os?: string;
  browser?: string;
  formFactor: "desktop" | "laptop" | "mobile" | "tablet";
  peerId: string;
  lastSeen: number;
}

export interface IncomingBeamNotice {
  fromPeer: Partial<DiscoveredPeer>;
  roomCode: string;
  timestamp: number;
}

// In-memory discovery fallback store
declare global {
  var __quicksendDiscoveryMemoryStore: Map<string, Map<string, DiscoveredPeer>> | undefined;
  var __quicksendDiscoveryPendingBeams: Map<string, IncomingBeamNotice> | undefined;
}

if (!globalThis.__quicksendDiscoveryMemoryStore) {
  globalThis.__quicksendDiscoveryMemoryStore = new Map();
}
const networkPeers = globalThis.__quicksendDiscoveryMemoryStore;

if (!globalThis.__quicksendDiscoveryPendingBeams) {
  globalThis.__quicksendDiscoveryPendingBeams = new Map();
}
const pendingBeams = globalThis.__quicksendDiscoveryPendingBeams;

function getRedisCredentials(): { url: string; token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
  return { url, token };
}

async function redisCommand<T = unknown>(args: (string | number)[]): Promise<T | null> {
  const { url, token } = getRedisCredentials();
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.result !== undefined ? data.result : null) as T;
  } catch {
    return null;
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export function isLocalOrPrivateIp(cleanIp: string): boolean {
  if (
    cleanIp === "127.0.0.1" ||
    cleanIp === "::1" ||
    cleanIp === "localhost" ||
    cleanIp === "::" ||
    cleanIp === "0.0.0.0" ||
    cleanIp === "::ffff:127.0.0.1"
  ) {
    return true;
  }

  // IPv4 loopback & RFC 1918 private check
  const rawIpv4 = cleanIp.startsWith("::ffff:") ? cleanIp.substring(7) : cleanIp;
  if (rawIpv4.includes(".")) {
    const parts = rawIpv4.split(".").map((n) => parseInt(n, 10));
    if (parts.length === 4 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
      const [b0, b1] = parts;
      if (b0 === 127) return true; // 127.0.0.0/8 loopback
      if (b0 === 10) return true; // 10.0.0.0/8
      if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12
      if (b0 === 169 && b1 === 254) return true; // Link-local
    }
  }

  // IPv6 ULA (fc00::/7) or Link-Local (fe80::/10)
  const lower = cleanIp.toLowerCase();
  if (
    lower.startsWith("fe80:") ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower === "::1"
  ) {
    return true;
  }

  return false;
}

export function normalizeIpv6Prefix(cleanIp: string): string {
  const lower = cleanIp.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    return lower.substring(7);
  }

  const parts = lower.split(":");
  if (lower.includes("::")) {
    const [left] = lower.split("::");
    const leftHextets = left ? left.split(":").filter(Boolean) : [];
    if (leftHextets.length >= 4) {
      return leftHextets.slice(0, 4).join(":");
    }
    return `${leftHextets.join(":")}::/64`;
  }

  if (parts.length >= 4) {
    return parts.slice(0, 4).join(":");
  }
  return lower;
}

export function computeNetworkId(rawIp: string): string {
  let ip = (rawIp || "127.0.0.1").trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // Group all local loopback and RFC 1918 private LAN IPs under a shared 'local-lan' key
  if (isLocalOrPrivateIp(ip)) {
    return "local-lan";
  }

  // Normalize IPv6 addresses to their /64 network prefix so peers on the same router discover each other
  if (ip.includes(":")) {
    const prefix = normalizeIpv6Prefix(ip);
    let hash = 0;
    for (let i = 0; i < prefix.length; i++) {
      hash = (hash << 5) - hash + prefix.charCodeAt(i);
      hash |= 0;
    }
    return `v6_${Math.abs(hash).toString(36)}`;
  }

  // Public IPv4 router gateway
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = (hash << 5) - hash + ip.charCodeAt(i);
    hash |= 0;
  }
  return `lan_${Math.abs(hash).toString(36)}`;
}

function pruneStalePeers(peers: Map<string, DiscoveredPeer>, ttlMs = 15000): DiscoveredPeer[] {
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

async function getNetworkPeers(networkId: string): Promise<DiscoveredPeer[]> {
  const now = Date.now();
  if (isRedisConfigured()) {
    try {
      const raw = await redisCommand<Record<string, string> | string[]>([
        "HGETALL",
        `quicksend:discover:${networkId}`,
      ]);
      if (raw) {
        const peers: DiscoveredPeer[] = [];
        const expiredIds: string[] = [];

        if (Array.isArray(raw)) {
          for (let i = 0; i < raw.length; i += 2) {
            try {
              const p: DiscoveredPeer = JSON.parse(raw[i + 1]);
              if (now - p.lastSeen <= 15000) {
                peers.push(p);
              } else {
                expiredIds.push(raw[i]);
              }
            } catch {
              // Ignore corrupt
            }
          }
        } else {
          for (const [id, val] of Object.entries(raw)) {
            try {
              const p: DiscoveredPeer = JSON.parse(val);
              if (now - p.lastSeen <= 15000) {
                peers.push(p);
              } else {
                expiredIds.push(id);
              }
            } catch {
              // Ignore corrupt
            }
          }
        }

        if (expiredIds.length > 0) {
          redisCommand(["HDEL", `quicksend:discover:${networkId}`, ...expiredIds]).catch(() => {});
        }
        return peers;
      }
    } catch {
      // Fallback to memory on Redis error
    }
  }

  let peersMap = networkPeers.get(networkId);
  if (!peersMap) {
    peersMap = new Map();
    networkPeers.set(networkId, peersMap);
  }
  return pruneStalePeers(peersMap);
}

async function savePeer(networkId: string, peer: DiscoveredPeer): Promise<void> {
  if (isRedisConfigured()) {
    try {
      await redisCommand([
        "HSET",
        `quicksend:discover:${networkId}`,
        peer.id,
        JSON.stringify(peer),
      ]);
      await redisCommand(["EXPIRE", `quicksend:discover:${networkId}`, 60]);
    } catch {
      // Ignore
    }
  }

  let peersMap = networkPeers.get(networkId);
  if (!peersMap) {
    peersMap = new Map();
    networkPeers.set(networkId, peersMap);
  }
  peersMap.set(peer.id, peer);
}

async function removePeer(networkId: string, deviceId: string): Promise<void> {
  if (isRedisConfigured()) {
    try {
      await redisCommand(["HDEL", `quicksend:discover:${networkId}`, deviceId]);
    } catch {
      // Ignore
    }
  }

  const peersMap = networkPeers.get(networkId);
  if (peersMap) {
    peersMap.delete(deviceId);
  }
}

async function saveBeam(targetDeviceId: string, notice: IncomingBeamNotice): Promise<void> {
  if (isRedisConfigured()) {
    try {
      await redisCommand([
        "SET",
        `quicksend:beam:${targetDeviceId}`,
        JSON.stringify(notice),
        "EX",
        45,
      ]);
    } catch {
      // Ignore
    }
  }
  pendingBeams.set(targetDeviceId, notice);
}

async function getAndClearBeam(deviceId: string): Promise<IncomingBeamNotice | null> {
  const now = Date.now();
  if (isRedisConfigured()) {
    try {
      const raw = await redisCommand<string | null>(["GET", `quicksend:beam:${deviceId}`]);
      if (raw) {
        const notice: IncomingBeamNotice = JSON.parse(raw);
        if (now - notice.timestamp < 45000) {
          return notice;
        }
      }
    } catch {
      // Ignore
    }
  }

  const beam = pendingBeams.get(deviceId);
  if (beam && now - beam.timestamp < 45000) {
    return beam;
  } else if (beam) {
    pendingBeams.delete(deviceId);
  }
  return null;
}

async function clearBeam(deviceId: string): Promise<void> {
  if (isRedisConfigured()) {
    try {
      await redisCommand(["DEL", `quicksend:beam:${deviceId}`]);
    } catch {
      // Ignore
    }
  }
  pendingBeams.delete(deviceId);
}

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const networkId = computeNetworkId(ip);
    const peers = await getNetworkPeers(networkId);

    return NextResponse.json({
      success: true,
      networkId,
      peers,
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
    const {
      action,
      deviceId,
      name,
      codename,
      avatarEmoji,
      avatarColor,
      os,
      browser,
      formFactor,
      peerId,
      networkId: customNetworkId,
    } = body;

    const targetNetworkId = customNetworkId || defaultNetworkId;

    if (action === "announce") {
      if (!deviceId) {
        return NextResponse.json({ success: false, error: "deviceId required" }, { status: 400 });
      }

      // Check existing active peers on this network (excluding caller)
      const activePeers = await getNetworkPeers(targetNetworkId);
      const otherPeers = activePeers.filter((p) => p.id !== deviceId);

      // Collect emojis already in use by other peers on this subnet
      const takenEmojis = new Set(otherPeers.map((p) => p.avatarEmoji).filter(Boolean));

      let assignedEmoji = avatarEmoji || "🦊";
      let assignedCodename = codename || name || "Curious Fox";
      let assignedColor = avatarColor || "#F97316";

      // If announcing device's emoji is already taken on this network, reassign to next available preset
      if (takenEmojis.has(assignedEmoji)) {
        const available = AVATAR_PRESETS.find((preset) => !takenEmojis.has(preset.emoji));
        if (available) {
          assignedEmoji = available.emoji;
          assignedCodename = available.codename;
          assignedColor = available.color;
        }
      }

      const peerRecord: DiscoveredPeer = {
        id: deviceId,
        name: name || "Anonymous Peer",
        codename: assignedCodename,
        avatarEmoji: assignedEmoji,
        avatarColor: assignedColor,
        os: os || "Device",
        browser: browser || "Browser",
        formFactor: formFactor || "laptop",
        peerId: peerId || deviceId,
        lastSeen: Date.now(),
      };

      await savePeer(targetNetworkId, peerRecord);

      // Check if another peer on this subnet initiated a direct beam to this device
      const incomingBeam = await getAndClearBeam(deviceId);

      return NextResponse.json({
        success: true,
        networkId: targetNetworkId,
        peers: otherPeers,
        assignedAvatar: {
          codename: assignedCodename,
          avatarEmoji: assignedEmoji,
          avatarColor: assignedColor,
        },
        incomingBeam: incomingBeam || null,
      });
    }

    if (action === "beam") {
      const { targetDeviceId, fromPeer, roomCode } = body;
      if (!targetDeviceId || !roomCode) {
        return NextResponse.json(
          { success: false, error: "targetDeviceId and roomCode required" },
          { status: 400 }
        );
      }
      await saveBeam(targetDeviceId, {
        fromPeer: fromPeer || { id: deviceId, name: name || "Nearby Peer" },
        roomCode,
        timestamp: Date.now(),
      });
      return NextResponse.json({ success: true });
    }

    if (action === "clearBeam") {
      if (deviceId) {
        await clearBeam(deviceId);
      }
      return NextResponse.json({ success: true });
    }

    if (action === "leave") {
      if (deviceId) {
        await removePeer(targetNetworkId, deviceId);
        await clearBeam(deviceId);
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
