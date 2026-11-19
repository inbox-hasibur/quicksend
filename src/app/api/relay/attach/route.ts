import { NextResponse } from "next/server";
import { signalStore } from "@/lib/signalStore";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { isAllowedRelayUrl } from "@/lib/upstashBlob";
import {
  RELAY_CHUNK_BYTES,
  RELAY_MAX_FILE_BYTES,
  RELAY_MAX_TRANSFER_BYTES,
  RELAY_MAX_FILES,
  RELAY_MAX_CHUNKS_PER_FILE,
} from "@/lib/relayLimits";
import type { SignalingRoomState } from "@/types/signaling";

interface AttachItemInput {
  url: string;
  pathname: string;
  name: string;
  size: number;
  mimeType: string;
  iv: string;
}

interface AttachFileInput {
  id: string;
  name: string;
  size: number;
  mimeType?: string;
  chunkCount: number;
  ivPrefix: string;
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
  if (!room || !room.relay) {
    return NextResponse.json({ relay: null });
  }

  // Return manifest without any encryption key
  if (room.relay.files !== undefined) {
    return NextResponse.json({
      relay: {
        rid: room.relay.rid,
        baseUrl: room.relay.baseUrl,
        salt: room.relay.salt,
        files: room.relay.files,
        text: room.relay.text,
        createdAt: room.relay.createdAt,
      },
    });
  }

  return NextResponse.json({ relay: room.relay });
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (await hitLimit(`ratelimit:relay:attach:${ip}`, 30, 60)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { roomCode, rid, salt, baseUrl, files, items, text } = body;

    if (!roomCode || typeof roomCode !== "string" || !isValidRoomCode(roomCode)) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    if (!salt || typeof salt !== "string") {
      return NextResponse.json({ error: "Invalid salt" }, { status: 400 });
    }

    const cleanCode = normalizeRoomCode(roomCode);

    // Chunk-based encrypted relay payload
    if (Array.isArray(files)) {
      if (files.length > RELAY_MAX_FILES) {
        return NextResponse.json({ error: "Invalid files count" }, { status: 400 });
      }

      if (files.length === 0 && (!text || typeof text !== "object")) {
        return NextResponse.json({ error: "No payload provided" }, { status: 400 });
      }

      if (files.length > 0) {
        if (!rid || typeof rid !== "string" || !/^[0-9a-f]{32}$/i.test(rid)) {
          return NextResponse.json({ error: "Invalid rid" }, { status: 400 });
        }

        if (!baseUrl || typeof baseUrl !== "string" || !isAllowedRelayUrl(baseUrl, roomCode)) {
          return NextResponse.json({ error: "Forbidden storage host" }, { status: 400 });
        }
      } else {
        if (rid && (typeof rid !== "string" || !/^[0-9a-f]{32}$/i.test(rid))) {
          return NextResponse.json({ error: "Invalid rid" }, { status: 400 });
        }
        if (baseUrl && (typeof baseUrl !== "string" || !isAllowedRelayUrl(baseUrl, roomCode))) {
          return NextResponse.json({ error: "Forbidden storage host" }, { status: 400 });
        }
      }

      let totalSize = 0;
      for (const file of files as AttachFileInput[]) {
        if (!file || typeof file !== "object") {
          return NextResponse.json({ error: "Invalid file object" }, { status: 400 });
        }

        if (typeof file.id !== "string" || !/^[0-9a-f]{16}$/i.test(file.id)) {
          return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
        }

        if (typeof file.name !== "string" || file.name.length === 0 || file.name.length > 200) {
          return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
        }

        if (
          typeof file.size !== "number" ||
          !Number.isInteger(file.size) ||
          file.size < 0 ||
          file.size > RELAY_MAX_FILE_BYTES
        ) {
          return NextResponse.json({ error: "File exceeds size limit" }, { status: 400 });
        }

        const expectedChunkCount = Math.ceil(file.size / RELAY_CHUNK_BYTES);
        if (
          typeof file.chunkCount !== "number" ||
          file.chunkCount !== expectedChunkCount ||
          file.chunkCount > RELAY_MAX_CHUNKS_PER_FILE
        ) {
          return NextResponse.json({ error: "Chunk count mismatch" }, { status: 400 });
        }

        if (typeof file.ivPrefix !== "string" || !file.ivPrefix) {
          return NextResponse.json({ error: "Invalid ivPrefix" }, { status: 400 });
        }

        totalSize += file.size;
      }

      if (totalSize > RELAY_MAX_TRANSFER_BYTES) {
        return NextResponse.json(
          { error: "Total transfer size exceeds limit" },
          { status: 400 }
        );
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

      const relayPayload: SignalingRoomState["relay"] = {
        salt,
        createdAt: Date.now(),
        ...(rid ? { rid } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        files: (files as AttachFileInput[]).map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          mimeType: typeof f.mimeType === "string" ? f.mimeType : "application/octet-stream",
          chunkCount: f.chunkCount,
          ivPrefix: f.ivPrefix,
        })),
        items: [],
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
    }

    // Legacy single-blob format support
    if (Array.isArray(items)) {
      if (items.length > RELAY_MAX_FILES) {
        return NextResponse.json({ error: "Invalid items list" }, { status: 400 });
      }

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

        if (typeof item.size !== "number" || item.size < 0 || item.size > RELAY_MAX_FILE_BYTES + 16) {
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
          !cleanItemPath.toLowerCase().startsWith(expectedPrefixClean.toLowerCase()) &&
          !cleanItemPath.toLowerCase().startsWith(expectedPrefixRaw.toLowerCase())
        ) {
          return NextResponse.json({ error: "Invalid pathname match" }, { status: 400 });
        }
      }

      const relayPayload: SignalingRoomState["relay"] = {
        salt,
        createdAt: Date.now(),
        items: (items as AttachItemInput[]).map((it) => ({
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
    }

    return NextResponse.json({ error: "Missing files or items" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
