import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { signalStore } from "@/lib/signalStore";

const MAX_DAILY_BYTES = 629145600; // 600 MB

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Relay not configured" }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string, clientPayload: string | null) => {
        if (!clientPayload) {
          throw new Error("Missing client payload");
        }

        let parsed: { roomCode?: unknown; size?: unknown };
        try {
          parsed = JSON.parse(clientPayload);
        } catch {
          throw new Error("Invalid client payload JSON");
        }

        const { roomCode, size } = parsed;

        if (!roomCode || typeof roomCode !== "string" || !isValidRoomCode(roomCode)) {
          throw new Error("Invalid room code");
        }

        if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > 52428800) {
          throw new Error("Invalid size");
        }

        const cleanPathname = pathname.startsWith("/") ? pathname.slice(1) : pathname;
        const escapedRaw = roomCode.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
        const cleanCode = normalizeRoomCode(roomCode);
        const escapedClean = cleanCode.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

        const regexRaw = new RegExp(`^relay/${escapedRaw}/[A-Za-z0-9._-]{1,80}$`);
        const regexClean = new RegExp(`^relay/${escapedClean}/[A-Za-z0-9._-]{1,80}$`);

        if (!regexRaw.test(cleanPathname) && !regexClean.test(cleanPathname)) {
          throw new Error("Invalid pathname");
        }

        const ip = clientIp(request);
        const isLimited = await hitLimit(`ratelimit:relay:token:${ip}`, 6, 3600);
        if (isLimited) {
          throw new Error("Too many uploads");
        }

        const today = new Date().toISOString().slice(0, 10);
        const budgetKey = `relay-bytes:${today}`;
        const currentRaw = await signalStore.getKey(budgetKey);
        const currentBytes = currentRaw ? Number.parseInt(currentRaw, 10) || 0 : 0;
        const newTotal = currentBytes + size;

        if (newTotal > MAX_DAILY_BYTES) {
          throw new Error("Relay daily limit reached");
        }

        await signalStore.setKey(budgetKey, String(newTotal), 86400);

        return {
          allowedContentTypes: ["application/octet-stream"],
          maximumSizeInBytes: size + 16,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload error" },
      { status: 400 }
    );
  }
}
