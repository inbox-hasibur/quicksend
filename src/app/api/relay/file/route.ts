import { NextResponse } from "next/server";
import { signalStore } from "@/lib/signalStore";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { getUpstashBucket, isAllowedRelayUrl, isUpstashBlobConfigured } from "@/lib/upstashBlob";
import { chunkPath } from "@/lib/relayChunks";

export async function GET(request: Request): Promise<Response> {
  const ip = clientIp(request);
  // Rate limit 600 requests per 10 minutes (600s) per IP
  if (await hitLimit(`ratelimit:relay:file:${ip}`, 600, 600)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("code");
  const fileId = searchParams.get("f");
  const rawIndex = searchParams.get("i");

  if (!rawCode || !isValidRoomCode(rawCode)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  if (!fileId || typeof fileId !== "string" || !/^[0-9a-f]{16}$/i.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  if (rawIndex === null || rawIndex === undefined || rawIndex.trim() === "") {
    return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
  }

  const index = Number.parseInt(rawIndex, 10);
  if (Number.isNaN(index) || index < 0) {
    return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
  }

  const cleanCode = normalizeRoomCode(rawCode);
  const room = await signalStore.getRoom(cleanCode, "code");
  if (!room || !room.relay) {
    return NextResponse.json({ error: "Transfer not found or expired" }, { status: 404 });
  }

  const rid = room.relay.rid;
  if (!rid) {
    return NextResponse.json({ error: "Relay session not found" }, { status: 404 });
  }

  const file = room.relay.files?.find((fl) => fl.id === fileId);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (index >= file.chunkCount) {
    return NextResponse.json({ error: "Chunk index out of bounds" }, { status: 404 });
  }

  // Canonical storage path built strictly from verified store manifest - never from query URL
  const path = chunkPath(cleanCode, rid, file.id, index);

  try {
    let upstream: Response;

    if (isUpstashBlobConfigured()) {
      try {
        const bucket = getUpstashBucket();
        const signed = await bucket.signedReadUrl(path, { expiresIn: "5m" });
        upstream = await fetch(signed.url, { cache: "no-store" });
      } catch (bucketErr) {
        if (room.relay.baseUrl) {
          const cleanBase = room.relay.baseUrl.replace(/\/$/, "");
          const fullUrl = `${cleanBase}/${path}`;
          if (!isAllowedRelayUrl(fullUrl, cleanCode)) {
            return NextResponse.json({ error: "Forbidden storage host" }, { status: 403 });
          }
          upstream = await fetch(fullUrl, { cache: "no-store" });
        } else {
          throw bucketErr;
        }
      }
    } else if (room.relay.baseUrl) {
      const cleanBase = room.relay.baseUrl.replace(/\/$/, "");
      const fullUrl = `${cleanBase}/${path}`;
      if (!isAllowedRelayUrl(fullUrl, cleanCode)) {
        return NextResponse.json({ error: "Forbidden storage host" }, { status: 403 });
      }
      upstream = await fetch(fullUrl, { cache: "no-store" });
    } else {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Failed to stream chunk from storage" },
        { status: upstream.status || 502 }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");
    headers.set("Cache-Control", "no-store");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch chunk" },
      { status: 502 }
    );
  }
}
