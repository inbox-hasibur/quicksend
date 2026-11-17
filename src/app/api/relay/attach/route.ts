import { NextResponse } from "next/server";
import { signalStore } from "@/lib/signalStore";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { isAllowedRelayUrl } from "@/lib/upstashBlob";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 52428816; // 50MB + 16 bytes AES-GCM tag

interface AttachItemInput {
  url: string;
  pathname: string;
  name: string;
  size: number;
  mimeType: string;
  iv: string;
}

export async function GET(request: Request) {
  const ip = clientIp(request);
  if (await hitLimit(`ratelimit:relay:get:${ip}`, 30, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("code");
  if (!rawCode || !isValidRoomCode(rawCode)) {
    return NextResponse.json({ relay: null });
  }

  const cleanCode = normalizeRoomCode(rawCode);
  const room = await signalStore.getRoom(cleanCode, "code");
  if (!room) {
    return NextResponse.json({ relay: null });
  }

  return NextResponse.json({ relay: room.relay ?? null });
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (await hitLimit(`ratelimit:relay:attach:${ip}`, 30, 60)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { roomCode, salt, items, text } = body;

    if (!roomCode || typeof roomCode !== "string" || !isValidRoomCode(roomCode)) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    if (!salt || typeof salt !== "string") {
      return NextResponse.json({ error: "Invalid salt" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length > MAX_FILES) {
      return NextResponse.json({ error: "Invalid items list" }, { status: 400 });
    }

    const cleanCode = normalizeRoomCode(roomCode);
    const expectedPrefixClean = `/relay/${cleanCode}/`;
    const expectedPrefixRaw = `/relay/${roomCode}/`;

    for (const item of items as AttachItemInput[]) {
      if (!item || typeof item !== "object") {
        return NextResponse.json({ error: "Invalid item" }, { status: 400 });
      }

      if (typeof item.name !== "string" || item.name.length > 200) {
        return NextResponse.json({ error: "Invalid item name" }, { status: 400 });
      }

      if (typeof item.mimeType !== "string" || item.mimeType.length > 100) {
        return NextResponse.json({ error: "Invalid mimeType" }, { status: 400 });
      }

      if (typeof item.size !== "number" || item.size < 0 || item.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File exceeds size limit" }, { status: 400 });
      }

      if (typeof item.iv !== "string" || !item.iv) {
        return NextResponse.json({ error: "Invalid item iv" }, { status: 400 });
      }

      if (typeof item.url !== "string" || typeof item.pathname !== "string") {
        return NextResponse.json({ error: "Invalid url or pathname" }, { status: 400 });
      }

      if (!isAllowedRelayUrl(item.url, roomCode)) {
        return NextResponse.json({ error: "Forbidden storage host" }, { status: 400 });
      }

      const cleanItemPath = item.pathname.startsWith("/") ? item.pathname : `/${item.pathname}`;
      if (
        !cleanItemPath.startsWith(expectedPrefixClean) &&
        !cleanItemPath.startsWith(expectedPrefixRaw)
      ) {
        return NextResponse.json({ error: "Invalid pathname match" }, { status: 400 });
      }
    }

    if (text !== undefined) {
      if (
        !text ||
        typeof text !== "object" ||
        typeof text.cipherText !== "string" ||
        typeof text.iv !== "string"
      ) {
        return NextResponse.json({ error: "Invalid text payload" }, { status: 400 });
      }
    }

    const relayPayload = {
      salt,
      createdAt: Date.now(),
      items: items.map((it: AttachItemInput) => ({
        url: it.url,
        pathname: it.pathname,
        name: it.name,
        size: it.size,
        mimeType: it.mimeType,
        iv: it.iv,
      })),
      ...(text ? { text: { cipherText: text.cipherText, iv: text.iv } } : {}),
    };

    let room = await signalStore.getRoom(cleanCode, "code");
    if (!room) {
      const created = await signalStore.createRoom(cleanCode);
      if (!created.success) {
        return NextResponse.json({ error: created.error }, { status: created.code });
      }
      room = created.room;
    }

    await signalStore.updateRoom(room.roomId, (r) => {
      r.relay = relayPayload;
      return r;
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
