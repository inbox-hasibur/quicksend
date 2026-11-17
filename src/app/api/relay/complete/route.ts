import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { signalStore } from "@/lib/signalStore";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";

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

    // Only delete URLs found in the verified store
    const urlsToDelete = (room.relay.items || [])
      .map((item) => item.url)
      .filter((url) => typeof url === "string" && url.length > 0);

    if (urlsToDelete.length > 0) {
      try {
        await del(urlsToDelete);
      } catch (blobErr) {
        // Log blob deletion error but continue to clear store
        console.warn("Blob deletion warning:", blobErr);
      }
    }

    await signalStore.updateRoom(room.roomId, (r) => {
      delete r.relay;
      return r;
    });

    return NextResponse.json({ deleted: urlsToDelete.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
