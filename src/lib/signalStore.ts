import { generateRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import type { SignalingRoomState } from "@/types/signaling";

export type StorageMode = "redis" | "memory";

export interface SignalStoreAdapter {
  createRoom(customCode?: string): Promise<
    | { success: true; room: SignalingRoomState }
    | { success: false; error: string; code: 400 | 409 }
  >;
  getRoom(identifier: string, by?: "id" | "code"): Promise<SignalingRoomState | null>;
  updateRoom(
    roomId: string,
    updater: (room: SignalingRoomState) => SignalingRoomState | void | Promise<SignalingRoomState | void>
  ): Promise<SignalingRoomState | null>;
  deleteRoom(roomId: string): Promise<boolean>;
  getStorageMode(): StorageMode;
  getActiveRoomCount(): Promise<number>;
  clear?(): Promise<void>;
  getKey(key: string): Promise<string | null>;
  setKey(key: string, value: string, ttlSeconds?: number): Promise<void>;
  deleteKey(key: string): Promise<boolean>;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ROOMS = 5000;

/**
 * Ephemeral In-Memory Signal Store with TTL pruning and capacity guard.
 * Suitable for local development, testing, and zero-config single-node setups.
 */
export class MemorySignalStore implements SignalStoreAdapter {
  private rooms: Map<string, SignalingRoomState> = new Map();
  private codeToRoomId: Map<string, string> = new Map();
  private genericKeys: Map<string, { value: string; expiresAt: number }> = new Map();
  private lastCleanup: number = Date.now();
  private ttlMs: number;
  private maxRooms: number;

  constructor(ttlMs = DEFAULT_TTL_MS, maxRooms = DEFAULT_MAX_ROOMS) {
    this.ttlMs = ttlMs;
    this.maxRooms = maxRooms;
  }

  getStorageMode(): StorageMode {
    return "memory";
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.createdAt > this.ttlMs) {
        this.codeToRoomId.delete(room.code);
        this.rooms.delete(roomId);
      }
    }

    for (const [key, entry] of this.genericKeys.entries()) {
      if (now > entry.expiresAt) {
        this.genericKeys.delete(key);
      }
    }

    // Capacity guard: evict oldest rooms if maxRooms exceeded
    if (this.rooms.size > this.maxRooms) {
      const sorted = Array.from(this.rooms.entries()).sort(
        (a, b) => a[1].createdAt - b[1].createdAt
      );
      const toEvict = sorted.slice(0, this.rooms.size - this.maxRooms);
      for (const [roomId, room] of toEvict) {
        this.codeToRoomId.delete(room.code);
        this.rooms.delete(roomId);
      }
    }
  }

  async createRoom(customCode?: string) {
    this.pruneStale();

    let code = "";
    if (customCode) {
      code = normalizeRoomCode(customCode);
      if (code.length < 4 || code.length > 20) {
        return {
          success: false as const,
          error: "Custom key must be between 4 and 20 characters",
          code: 400 as const,
        };
      }
      if (this.codeToRoomId.has(code)) {
        return {
          success: false as const,
          error: `Room key "${code}" is currently in use. Please choose another.`,
          code: 409 as const,
        };
      }
    } else {
      let attempts = 0;
      do {
        code = generateRoomCode();
        attempts++;
      } while (this.codeToRoomId.has(code) && attempts < 20);

      if (this.codeToRoomId.has(code)) {
        return {
          success: false as const,
          error: "Failed to generate unique room key. Try again.",
          code: 409 as const,
        };
      }
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRoom: SignalingRoomState = {
      roomId,
      code,
      createdAt: Date.now(),
      senderJoined: true,
      receiverJoined: false,
      messages: [],
    };

    this.rooms.set(roomId, newRoom);
    this.codeToRoomId.set(code, roomId);

    return { success: true as const, room: newRoom };
  }

  async getRoom(identifier: string, by?: "id" | "code"): Promise<SignalingRoomState | null> {
    this.pruneStale();
    let targetRoomId: string | undefined;

    if (by === "code" || (!by && !identifier.startsWith("room_"))) {
      const cleanCode = normalizeRoomCode(identifier);
      targetRoomId = this.codeToRoomId.get(cleanCode);
    } else {
      targetRoomId = identifier;
    }

    if (!targetRoomId) return null;
    const room = this.rooms.get(targetRoomId);
    if (!room) return null;

    if (Date.now() - room.createdAt > this.ttlMs) {
      this.codeToRoomId.delete(room.code);
      this.rooms.delete(targetRoomId);
      return null;
    }

    return room;
  }

  async updateRoom(
    roomId: string,
    updater: (room: SignalingRoomState) => SignalingRoomState | void | Promise<SignalingRoomState | void>
  ): Promise<SignalingRoomState | null> {
    const room = await this.getRoom(roomId, "id");
    if (!room) return null;

    const result = await updater(room);
    const updated = result || room;
    this.rooms.set(roomId, updated);
    return updated;
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    this.codeToRoomId.delete(room.code);
    this.rooms.delete(roomId);
    return true;
  }

  async getActiveRoomCount(): Promise<number> {
    this.pruneStale();
    return this.rooms.size;
  }

  async clear(): Promise<void> {
    this.rooms.clear();
    this.codeToRoomId.clear();
    this.genericKeys.clear();
  }

  async getKey(key: string): Promise<string | null> {
    const entry = this.genericKeys.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.genericKeys.delete(key);
      return null;
    }
    return entry.value;
  }

  async setKey(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const existing = this.genericKeys.get(key);
    let expiresAt: number;
    if (ttlSeconds !== undefined) {
      expiresAt = Date.now() + ttlSeconds * 1000;
    } else if (existing && existing.expiresAt > Date.now()) {
      expiresAt = existing.expiresAt;
    } else {
      expiresAt = Date.now() + 60 * 1000;
    }
    this.genericKeys.set(key, { value, expiresAt });
  }

  async deleteKey(key: string): Promise<boolean> {
    return this.genericKeys.delete(key);
  }
}

/**
 * Upstash Redis / Vercel KV REST Signal Store.
 * Zero npm dependencies: uses native fetch with Upstash REST pipeline.
 * Activates automatically when UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN are present.
 */
export class RedisSignalStore implements SignalStoreAdapter {
  private ttlSeconds: number;

  constructor(ttlSeconds = 900) {
    this.ttlSeconds = ttlSeconds;
  }

  getStorageMode(): StorageMode {
    return "redis";
  }

  private getCredentials(): { url: string; token: string } {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error("Redis REST credentials missing");
    }
    return { url: url.replace(/\/$/, ""), token };
  }

  private async command<T = unknown>(args: (string | number)[]): Promise<T | null> {
    const { url, token } = this.getCredentials();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Redis REST HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return (data && data.result !== undefined ? data.result : null) as T;
  }

  private async pipeline<T = unknown[]>(commands: (string | number)[][]): Promise<T> {
    const { url, token } = this.getCredentials();
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Redis Pipeline HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data as T;
  }

  async createRoom(customCode?: string) {
    let code = "";
    if (customCode) {
      code = normalizeRoomCode(customCode);
      if (code.length < 4 || code.length > 20) {
        return {
          success: false as const,
          error: "Custom key must be between 4 and 20 characters",
          code: 400 as const,
        };
      }
      const existing = await this.command<string | null>(["GET", `quicksend:code:${code}`]);
      if (existing) {
        return {
          success: false as const,
          error: `Room key "${code}" is currently in use. Please choose another.`,
          code: 409 as const,
        };
      }
    } else {
      let attempts = 0;
      let collision = true;
      while (collision && attempts < 10) {
        code = generateRoomCode();
        const existing = await this.command<string | null>(["GET", `quicksend:code:${code}`]);
        collision = Boolean(existing);
        attempts++;
      }
      if (collision) {
        return {
          success: false as const,
          error: "Failed to generate unique room key. Try again.",
          code: 409 as const,
        };
      }
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const room: SignalingRoomState = {
      roomId,
      code,
      createdAt: Date.now(),
      senderJoined: true,
      receiverJoined: false,
      messages: [],
    };

    await this.pipeline([
      ["SET", `quicksend:room:${roomId}`, JSON.stringify(room), "EX", this.ttlSeconds],
      ["SET", `quicksend:code:${code}`, roomId, "EX", this.ttlSeconds],
    ]);

    return { success: true as const, room };
  }

  async getRoom(identifier: string, by?: "id" | "code"): Promise<SignalingRoomState | null> {
    let targetRoomId: string | null = null;
    if (by === "code" || (!by && !identifier.startsWith("room_"))) {
      const cleanCode = normalizeRoomCode(identifier);
      targetRoomId = await this.command<string | null>(["GET", `quicksend:code:${cleanCode}`]);
    } else {
      targetRoomId = identifier;
    }

    if (!targetRoomId) return null;

    const raw = await this.command<string | null>(["GET", `quicksend:room:${targetRoomId}`]);
    if (!raw) return null;

    try {
      return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as SignalingRoomState);
    } catch {
      return null;
    }
  }

  async updateRoom(
    roomId: string,
    updater: (room: SignalingRoomState) => SignalingRoomState | void | Promise<SignalingRoomState | void>
  ): Promise<SignalingRoomState | null> {
    const room = await this.getRoom(roomId, "id");
    if (!room) return null;

    const result = await updater(room);
    const updated = result || room;

    await this.command([
      "SET",
      `quicksend:room:${roomId}`,
      JSON.stringify(updated),
      "EX",
      this.ttlSeconds,
    ]);

    return updated;
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    const room = await this.getRoom(roomId, "id");
    if (!room) return false;

    await this.pipeline([
      ["DEL", `quicksend:room:${roomId}`],
      ["DEL", `quicksend:code:${room.code}`],
    ]);

    return true;
  }

  async getActiveRoomCount(): Promise<number> {
    try {
      const keys = await this.command<string[]>(["KEYS", "quicksend:room:*"]);
      return Array.isArray(keys) ? keys.length : 0;
    } catch {
      return 0;
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.command<string[]>(["KEYS", "quicksend:*"]);
      if (Array.isArray(keys) && keys.length > 0) {
        await this.command(["DEL", ...keys]);
      }
    } catch {
      // Ignore clear errors in testing
    }
  }

  async getKey(key: string): Promise<string | null> {
    return this.command<string | null>(["GET", `quicksend:${key}`]);
  }

  async setKey(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.command(["SET", `quicksend:${key}`, value, "EX", ttlSeconds]);
    } else {
      await this.command(["SET", `quicksend:${key}`, value]);
    }
  }

  async deleteKey(key: string): Promise<boolean> {
    const res = await this.command<number>(["DEL", `quicksend:${key}`]);
    return Boolean(res && res > 0);
  }
}

declare global {
  var __quicksendSignalMemoryStore: MemorySignalStore | undefined;
}

/**
 * Checks if Redis / Vercel KV environment variables are defined.
 */
export function isRedisConfigured(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

/**
 * Factory returning active SignalStore adapter based on runtime environment.
 */
export function getSignalStore(): SignalStoreAdapter {
  if (isRedisConfigured()) {
    return new RedisSignalStore();
  }
  if (!globalThis.__quicksendSignalMemoryStore) {
    globalThis.__quicksendSignalMemoryStore = new MemorySignalStore();
  }
  return globalThis.__quicksendSignalMemoryStore;
}

/**
 * Primary exported singleton proxy adapter.
 */
export const signalStore: SignalStoreAdapter = {
  createRoom: (customCode) => getSignalStore().createRoom(customCode),
  getRoom: (identifier, by) => getSignalStore().getRoom(identifier, by),
  updateRoom: (roomId, updater) => getSignalStore().updateRoom(roomId, updater),
  deleteRoom(roomId) {
    return getSignalStore().deleteRoom(roomId);
  },
  getStorageMode: () => getSignalStore().getStorageMode(),
  getActiveRoomCount: () => getSignalStore().getActiveRoomCount(),
  clear: () => getSignalStore().clear?.() ?? Promise.resolve(),
  getKey: (key) => getSignalStore().getKey(key),
  setKey: (key, value, ttlSeconds) => getSignalStore().setKey(key, value, ttlSeconds),
  deleteKey: (key) => getSignalStore().deleteKey(key),
};
