import { NextResponse } from "next/server";
import { signalStore } from "@/lib/signalStore";
import type { SignalMessage } from "@/types/signaling";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const code = searchParams.get("code");

    if (code) {
      const room = await signalStore.getRoom(code, "code");
      if (!room) {
        return NextResponse.json(
          { success: false, error: "Room not found or expired" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        roomId: room.roomId,
        code: room.code,
        senderJoined: room.senderJoined,
        receiverJoined: room.receiverJoined,
      });
    }

    if (roomId) {
      const room = await signalStore.getRoom(roomId, "id");
      if (!room) {
        return NextResponse.json(
          { success: false, error: "Room not found or expired" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        roomId: room.roomId,
        code: room.code,
        senderJoined: room.senderJoined,
        receiverJoined: room.receiverJoined,
      });
    }

    const activeRooms = await signalStore.getActiveRoomCount();
    return NextResponse.json({
      status: "ok",
      service: "quicksend-signaling",
      storage: signalStore.getStorageMode(),
      activeRooms,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create-room": {
        const result = await signalStore.createRoom(body.customCode);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: result.code }
          );
        }

        return NextResponse.json(
          {
            success: true,
            roomId: result.room.roomId,
            code: result.room.code,
          },
          { status: 200 }
        );
      }

      case "join-room": {
        const rawCode = body.code;
        if (!rawCode) {
          return NextResponse.json(
            { success: false, error: "Room code is required" },
            { status: 400 }
          );
        }

        const room = await signalStore.getRoom(rawCode, "code");
        if (!room) {
          return NextResponse.json(
            { success: false, error: "Invalid or expired room code" },
            { status: 404 }
          );
        }

        const joinMessage: SignalMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          roomId: room.roomId,
          senderRole: "receiver",
          targetRole: "sender",
          type: "peer-joined",
          timestamp: Date.now(),
        };

        await Promise.all([
          signalStore.appendSignal(room.code, joinMessage),
          signalStore.appendSignal(room.roomId, joinMessage),
          signalStore.updateRoom(room.roomId, (r) => {
            r.receiverJoined = true;
            r.messages.push(joinMessage);
            if (r.messages.length > 100) {
              r.messages.shift();
            }
          }),
        ]);

        return NextResponse.json({
          success: true,
          roomId: room.roomId,
          code: room.code,
        });
      }

      case "send-signal": {
        const { roomId, senderRole, targetRole, type, payload } = body;
        if (!roomId || !senderRole || !targetRole || !type) {
          return NextResponse.json(
            { success: false, error: "Missing required signal parameters" },
            { status: 400 }
          );
        }

        const room = await signalStore.getRoom(roomId, "id");
        if (!room) {
          return NextResponse.json(
            { success: false, error: "Room not found or expired" },
            { status: 404 }
          );
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

        await Promise.all([
          signalStore.appendSignal(room.code, message),
          signalStore.appendSignal(room.roomId, message),
        ]);

        return NextResponse.json({ success: true, messageId: message.id });
      }

      case "poll-signals": {
        const { roomId, role, afterTimestamp = 0 } = body;
        if (!roomId || !role) {
          return NextResponse.json(
            { success: false, error: "RoomId and role are required" },
            { status: 400 }
          );
        }

        const room = await signalStore.getRoom(roomId, "id");
        if (!room) {
          return NextResponse.json(
            { success: false, error: "Room not found or expired" },
            { status: 404 }
          );
        }

        const [signalsByCode, signalsById] = await Promise.all([
          signalStore.getSignals(room.code),
          signalStore.getSignals(room.roomId),
        ]);

        const seenIds = new Set<string>();
        const allMessages: SignalMessage[] = [];
        for (const msg of [...room.messages, ...signalsByCode, ...signalsById]) {
          if (msg && msg.id && !seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            allMessages.push(msg);
          }
        }

        const relevantMessages = allMessages.filter(
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
        if (roomId) {
          await signalStore.deleteRoom(roomId);
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
