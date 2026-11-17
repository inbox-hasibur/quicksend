import { NextResponse } from "next/server";
import { signalStore } from "@/lib/signalStore";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { getUpstashBucket, isUpstashBlobConfigured } from "@/lib/upstashBlob";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (await hitLimit(`ratelimit:relay:complete:${ip}`, 30, 60)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { roomCode } = body;

    if (!roomCode || typeof roomCode !== "string" || !isValidRoomCode(roomCode)) {
      return NextResponse.json({ deleted: 0 });
    }

    const cleanCode = normalizeRoomCode(roomCode);
    const room = await signalStore.getRoom(cleanCode, "code");

    if (!room || !room.relay) {
      return NextResponse.json({ deleted: 0 });
    }

    // Only delete items found in the verified store
    const targetsToDelete: string[] = (room.relay.items || [])
      .map((item) => {
        if (item.pathname) return item.pathname.replace(/^\//, "");
        if (item.url) {
          try {
            return new URL(item.url).pathname.replace(/^\//, "");
          } catch {
            return item.url;
          }
        }
        return "";
      })
      .filter(Boolean);

    if (targetsToDelete.length > 0 && isUpstashBlobConfigured()) {
      try {
        const bucket = getUpstashBucket();
        await bucket.del(targetsToDelete.length === 1 ? targetsToDelete[0] : targetsToDelete);
      } catch (blobErr) {
        // Log blob deletion error but continue to clear store
        console.warn("Blob deletion warning:", blobErr);
      }
    }

    await signalStore.updateRoom(room.roomId, (r) => {
      delete r.relay;
      return r;
    });

    return NextResponse.json({ deleted: targetsToDelete.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
