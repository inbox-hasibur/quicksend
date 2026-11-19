import { NextResponse } from "next/server";
import { signalStore } from "@/lib/signalStore";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { getUpstashBucket, isUpstashBlobConfigured } from "@/lib/upstashBlob";
import { chunkPath } from "@/lib/relayChunks";

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

    const deleteTargets = new Set<string>();

    // 1. Build chunk paths strictly from stored manifest
    const rid = room.relay.rid;
    const files = room.relay.files;
    if (rid && Array.isArray(files)) {
      for (const file of files) {
        for (let i = 0; i < file.chunkCount; i++) {
          deleteTargets.add(chunkPath(cleanCode, rid, file.id, i));
        }
      }
    }

    // Support legacy items if present
    if (Array.isArray(room.relay.items)) {
      for (const item of room.relay.items) {
        if (item.pathname) {
          deleteTargets.add(item.pathname.replace(/^\//, ""));
        } else if (item.url) {
          try {
            deleteTargets.add(new URL(item.url).pathname.replace(/^\//, ""));
          } catch {
            deleteTargets.add(item.url);
          }
        }
      }
    }

    let deletedCount = 0;

    if (isUpstashBlobConfigured()) {
      try {
        const bucket = getUpstashBucket();

        if (deleteTargets.size > 0) {
          const targetArray = Array.from(deleteTargets);
          await bucket.del(targetArray.length === 1 ? targetArray[0] : targetArray);
          deletedCount += targetArray.length;
        }

        // 2. Also list prefix "relay/<roomCode>/<rid>/" and delete leftovers
        if (rid) {
          const prefix = `relay/${cleanCode}/${rid}/`;
          let cursor: string | undefined = undefined;
          do {
            const page = await bucket.list({ prefix, limit: 100, cursor });
            const leftovers = (page.blobs || [])
              .map((b) => b.path)
              .filter((p) => Boolean(p) && !deleteTargets.has(p));

            if (leftovers.length > 0) {
              await bucket.del(leftovers.length === 1 ? leftovers[0] : leftovers);
              deletedCount += leftovers.length;
            }
            cursor = page.cursor;
          } while (cursor);
        }
      } catch (blobErr) {
        console.warn("Blob deletion warning:", blobErr);
      }
    }

    // Idempotently clear relay from store
    await signalStore.updateRoom(room.roomId, (r) => {
      delete r.relay;
      return r;
    });

    return NextResponse.json({ deleted: deletedCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
