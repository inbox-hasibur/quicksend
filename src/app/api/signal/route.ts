import { NextResponse } from "next/server";
import { generateRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import type { SignalMessage, SignalingRoomState } from "@/types/signaling";

// Ephemeral in-memory store for room signaling
interface GlobalSignalingState {
  rooms: Map<string, SignalingRoomState>;
  codeToRoomId: Map<string, string>;
  lastCleanup: number;
}

declare global {
  var __signalingStore: GlobalSignalingState | undefined;
}

const ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

function getStore(): GlobalSignalingState {
  if (!globalThis.__signalingStore) {
    globalThis.__signalingStore = {
      rooms: new Map(),
      codeToRoomId: new Map(),
      lastCleanup: Date.now(),
    };
  }

  // Periodic cleanup of expired rooms
  const now = Date.now();
  if (now - globalThis.__signalingStore.lastCleanup > 60000) {
    globalThis.__signalingStore.lastCleanup = now;
    for (const [roomId, room] of globalThis.__signalingStore.rooms.entries()) {
      if (now - room.createdAt > ROOM_TTL_MS) {
        globalThis.__signalingStore.codeToRoomId.delete(room.code);
        globalThis.__signalingStore.rooms.delete(roomId);
      }
    }
  }

  return globalThis.__signalingStore;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");
  const code = searchParams.get("code");
  const store = getStore();

  if (code) {
    const cleanCode = normalizeRoomCode(code);
    const targetRoomId = store.codeToRoomId.get(cleanCode);
    if (!targetRoomId || !store.rooms.has(targetRoomId)) {
      return NextResponse.json({ success: false, error: "Room not found or expired" }, { status: 404 });
    }
    const room = store.rooms.get(targetRoomId)!;
    return NextResponse.json({
      success: true,
      roomId: room.roomId,
      code: room.code,
      senderJoined: room.senderJoined,
      receiverJoined: room.receiverJoined,
    });
  }

  if (roomId) {
    const room = store.rooms.get(roomId);
    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found or expired" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      roomId: room.roomId,
      code: room.code,
      senderJoined: room.senderJoined,
      receiverJoined: room.receiverJoined,
    });
  }

  return NextResponse.json({
    status: "ok",
    service: "share-anything-signaling",
    activeRooms: store.rooms.size,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const store = getStore();

    switch (action) {
      case "create-room": {
        let code = "";
        if (body.customCode) {
          code = normalizeRoomCode(body.customCode);
          if (code.length < 4 || code.length > 20) {
            return NextResponse.json(
              { success: false, error: "Custom key must be between 4 and 20 characters" },
              { status: 400 }
            );
          }
          if (store.codeToRoomId.has(code)) {
            return NextResponse.json(
              { success: false, error: `Room key "${code}" is currently in use. Please choose another.` },
              { status: 409 }
            );
          }
        } else {
          code = generateRoomCode();
          while (store.codeToRoomId.has(code)) {
            code = generateRoomCode();
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

        store.rooms.set(roomId, newRoom);
        store.codeToRoomId.set(code, roomId);

        return NextResponse.json({
          success: true,
          roomId,
          code,
        });
      }

      case "join-room": {
        const rawCode = body.code;
        if (!rawCode) {
          return NextResponse.json({ success: false, error: "Room code is required" }, { status: 400 });
        }

        const cleanCode = normalizeRoomCode(rawCode);
        const roomId = store.codeToRoomId.get(cleanCode);
        if (!roomId || !store.rooms.has(roomId)) {
          return NextResponse.json({ success: false, error: "Invalid or expired room code" }, { status: 404 });
        }

        const room = store.rooms.get(roomId)!;
        room.receiverJoined = true;

        // Post peer-joined notification to room for sender
        const joinMessage: SignalMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          roomId,
          senderRole: "receiver",
          targetRole: "sender",
          type: "peer-joined",
          timestamp: Date.now(),
        };
        room.messages.push(joinMessage);

        return NextResponse.json({
          success: true,
          roomId,
          code: room.code,
        });
      }

      case "send-signal": {
        const { roomId, senderRole, targetRole, type, payload } = body;
        if (!roomId || !senderRole || !targetRole || !type) {
          return NextResponse.json({ success: false, error: "Missing required signal parameters" }, { status: 400 });
        }

        const room = store.rooms.get(roomId);
        if (!room) {
          return NextResponse.json({ success: false, error: "Room not found or expired" }, { status: 404 });
        }

        const message: SignalMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          roomId,
          senderRole,
          targetRole,
          type,
          payload,
          timestamp: Date.now(),
        };

        room.messages.push(message);

        // Keep message buffer under 100 items per room
        if (room.messages.length > 100) {
          room.messages.shift();
        }

        return NextResponse.json({ success: true, messageId: message.id });
      }

      case "poll-signals": {
        const { roomId, role, afterTimestamp = 0 } = body;
        if (!roomId || !role) {
          return NextResponse.json({ success: false, error: "RoomId and role are required" }, { status: 400 });
        }

        const room = store.rooms.get(roomId);
        if (!room) {
          return NextResponse.json({ success: false, error: "Room not found or expired" }, { status: 404 });
        }

        // Deliver messages aimed at this role after the last timestamp seen
        const relevantMessages = room.messages.filter(
          (m) => m.targetRole === role && m.timestamp > afterTimestamp
        );

        return NextResponse.json({
          success: true,
          messages: relevantMessages,
          serverTimestamp: Date.now(),
        });
      }

      case "leave-room": {
        const { roomId } = body;
        if (roomId && store.rooms.has(roomId)) {
          const room = store.rooms.get(roomId)!;
          store.codeToRoomId.delete(room.code);
          store.rooms.delete(roomId);
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
