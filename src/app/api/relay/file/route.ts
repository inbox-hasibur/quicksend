import { NextResponse } from "next/server";
import { signalStore } from "@/lib/signalStore";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { isAllowedRelayUrl } from "@/lib/upstashBlob";

export async function GET(request: Request): Promise<Response> {
  const ip = clientIp(request);
  if (await hitLimit(`ratelimit:relay:file:${ip}`, 60, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("code");
  const rawIndex = searchParams.get("index");

  if (!rawCode || !isValidRoomCode(rawCode)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const index = Number.parseInt(rawIndex || "", 10);
  if (Number.isNaN(index) || index < 0 || index > 5) {
    return NextResponse.json({ error: "Invalid item index" }, { status: 400 });
  }

  const cleanCode = normalizeRoomCode(rawCode);
  const room = await signalStore.getRoom(cleanCode, "code");
  if (!room || !room.relay || !Array.isArray(room.relay.items)) {
    return NextResponse.json({ error: "Transfer not found or expired" }, { status: 404 });
  }

  const item = room.relay.items[index];
  if (!item || !item.url) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (!isAllowedRelayUrl(item.url, cleanCode)) {
    return NextResponse.json({ error: "Forbidden storage host" }, { status: 403 });
  }

  try {
    const upstream = await fetch(item.url, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Failed to stream file from storage" },
        { status: upstream.status || 502 }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", item.mimeType || "application/octet-stream");
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
      { error: err instanceof Error ? err.message : "Stream error" },
      { status: 500 }
    );
  }
}
