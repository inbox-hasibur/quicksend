import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MemorySignalStore,
  RedisSignalStore,
  isRedisConfigured,
  getSignalStore,
} from "@/lib/signalStore";

describe("SignalStore - MemorySignalStore", () => {
  let store: MemorySignalStore;

  beforeEach(() => {
    store = new MemorySignalStore(1000, 10); // 1-second TTL, max 10 rooms for testing
  });

  it("should create a room with an auto-generated 6-digit code", async () => {
    const res = await store.createRoom();
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.room.roomId).toMatch(/^room_/);
    expect(res.room.code).toMatch(/^\d{6}$/);
    expect(res.room.senderJoined).toBe(true);
    expect(res.room.receiverJoined).toBe(false);
    expect(res.room.messages).toEqual([]);
  });

  it("should create a room with a custom code", async () => {
    const res = await store.createRoom("MY-ROOM-KEY-1");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.room.code).toBe("MYROOMKEY1");
  });

  it("should reject custom codes that are too short or too long", async () => {
    const shortRes = await store.createRoom("ab");
    expect(shortRes.success).toBe(false);
    if (shortRes.success) return;
    expect(shortRes.code).toBe(400);

    const longRes = await store.createRoom("abcdefghijklmnopqrstuvwxyz12345");
    expect(longRes.success).toBe(false);
    if (longRes.success) return;
    expect(longRes.code).toBe(400);
  });

  it("should return a 409 conflict when a custom room code is already active", async () => {
    const first = await store.createRoom("CUSTOMKEY1");
    expect(first.success).toBe(true);

    const duplicate = await store.createRoom("CUSTOMKEY1");
    expect(duplicate.success).toBe(false);
    if (duplicate.success) return;
    expect(duplicate.code).toBe(409);
    expect(duplicate.error).toContain("currently in use");
  });

  it("should retrieve rooms by ID or code", async () => {
    const created = await store.createRoom("SEARCHCODE");
    expect(created.success).toBe(true);
    if (!created.success) return;

    const byCode = await store.getRoom("SEARCHCODE", "code");
    expect(byCode).not.toBeNull();
    expect(byCode?.roomId).toBe(created.room.roomId);

    const byId = await store.getRoom(created.room.roomId, "id");
    expect(byId).not.toBeNull();
    expect(byId?.code).toBe("SEARCHCODE");
  });

  it("should update room state correctly", async () => {
    const created = await store.createRoom();
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await store.updateRoom(created.room.roomId, (room) => {
      room.receiverJoined = true;
      room.messages.push({
        id: "msg_1",
        roomId: room.roomId,
        senderRole: "receiver",
        targetRole: "sender",
        type: "peer-joined",
        timestamp: Date.now(),
      });
    });

    expect(updated).not.toBeNull();
    expect(updated?.receiverJoined).toBe(true);
    expect(updated?.messages.length).toBe(1);

    const fetched = await store.getRoom(created.room.roomId, "id");
    expect(fetched?.receiverJoined).toBe(true);
  });

  it("should delete rooms and code mapping", async () => {
    const created = await store.createRoom("DELETEKEY");
    expect(created.success).toBe(true);
    if (!created.success) return;

    const deleted = await store.deleteRoom(created.room.roomId);
    expect(deleted).toBe(true);

    const checkId = await store.getRoom(created.room.roomId, "id");
    expect(checkId).toBeNull();

    const checkCode = await store.getRoom("DELETEKEY", "code");
    expect(checkCode).toBeNull();
  });

  it("should prune rooms that have exceeded their TTL", async () => {
    const created = await store.createRoom("EXPIREKEY");
    expect(created.success).toBe(true);
    if (!created.success) return;

    // Simulate time passing beyond 1000ms TTL
    const originalNow = Date.now;
    Date.now = () => originalNow() + 2000;

    try {
      const expired = await store.getRoom("EXPIREKEY", "code");
      expect(expired).toBeNull();
    } finally {
      Date.now = originalNow;
    }
  });

  it("should enforce capacity guard when maxRooms is exceeded", async () => {
    const miniStore = new MemorySignalStore(60000, 3);
    await miniStore.createRoom("ROOM1");
    await miniStore.createRoom("ROOM2");
    await miniStore.createRoom("ROOM3");
    expect(await miniStore.getActiveRoomCount()).toBe(3);

    // Creating 4th room should prune oldest
    await miniStore.createRoom("ROOM4");
    expect(await miniStore.getActiveRoomCount()).toBeLessThanOrEqual(3);
  });

  it("should set, get, and delete generic string keys", async () => {
    await store.setKey("pin:1234", "dev_abc", 60);
    const value = await store.getKey("pin:1234");
    expect(value).toBe("dev_abc");

    const nonExistent = await store.getKey("pin:9999");
    expect(nonExistent).toBeNull();

    const deleted = await store.deleteKey("pin:1234");
    expect(deleted).toBe(true);

    const afterDelete = await store.getKey("pin:1234");
    expect(afterDelete).toBeNull();
  });

  it("should expire generic keys when their TTL is exceeded", async () => {
    await store.setKey("pin:5678", "dev_xyz", 1); // 1-second TTL
    expect(await store.getKey("pin:5678")).toBe("dev_xyz");

    // Advance simulated time past 1 second
    const originalNow = Date.now;
    Date.now = () => originalNow() + 1500;

    try {
      const expired = await store.getKey("pin:5678");
      expect(expired).toBeNull();
    } finally {
      Date.now = originalNow;
    }
  });
});

describe("SignalStore - RedisSignalStore (REST Mode with mocked fetch)", () => {
  const originalEnv = { ...process.env };
  const mockFetch = vi.fn();

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token-xyz";
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("should detect redis mode when env vars are defined", () => {
    expect(isRedisConfigured()).toBe(true);
    const store = getSignalStore();
    expect(store.getStorageMode()).toBe("redis");
  });

  it("should call Upstash REST API with Bearer token for room creation", async () => {
    // 1. GET code check returns null (no collision)
    // 2. pipeline sets room and code keys
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ result: "OK" }, { result: "OK" }],
      });

    const store = new RedisSignalStore(900);
    const res = await store.createRoom("TESTKEY1");

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.room.code).toBe("TESTKEY1");

    // Verify first call was checking if code exists
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://mock-redis.upstash.io",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-token-xyz",
        }),
        body: JSON.stringify(["GET", "quicksend:code:TESTKEY1"]),
      })
    );

    // Verify second call was pipeline to set both room and code
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://mock-redis.upstash.io/pipeline",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-token-xyz",
        }),
      })
    );
  });

  it("should handle 409 conflict when code already exists in Redis", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "room_existing_123" }),
    });

    const store = new RedisSignalStore(900);
    const res = await store.createRoom("COLLISIONKEY");

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.code).toBe(409);
  });

  it("should retrieve room by code from Redis", async () => {
    const mockRoom = {
      roomId: "room_123",
      code: "REDISCODE",
      createdAt: Date.now(),
      senderJoined: true,
      receiverJoined: false,
      messages: [],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: "room_123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: JSON.stringify(mockRoom) }),
      });

    const store = new RedisSignalStore(900);
    const room = await store.getRoom("REDISCODE", "code");

    expect(room).not.toBeNull();
    expect(room?.roomId).toBe("room_123");
    expect(room?.code).toBe("REDISCODE");
  });

  it("should delete room and code mapping from Redis via pipeline", async () => {
    const mockRoom = {
      roomId: "room_del_123",
      code: "DELREDIS",
      createdAt: Date.now(),
      senderJoined: true,
      receiverJoined: false,
      messages: [],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: JSON.stringify(mockRoom) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ result: 1 }, { result: 1 }],
      });

    const store = new RedisSignalStore(900);
    const deleted = await store.deleteRoom("room_del_123");

    expect(deleted).toBe(true);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://mock-redis.upstash.io/pipeline",
      expect.objectContaining({
        body: JSON.stringify([
          ["DEL", "quicksend:room:room_del_123"],
          ["DEL", "quicksend:code:DELREDIS"],
        ]),
      })
    );
  });
});
