import { NextResponse } from "next/server";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp, hitLimit } from "@/lib/rateLimit";
import { signalStore } from "@/lib/signalStore";
import { getUpstashBucket, isUpstashBlobConfigured } from "@/lib/upstashBlob";

const MAX_DAILY_BYTES = 629145600; // 600 MB

export async function POST(request: Request): Promise<NextResponse> {
  if (!isUpstashBlobConfigured()) {
    return NextResponse.json({ error: "Relay not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const rawPayloadObj = body?.payload as Record<string, unknown> | undefined;
    const rawPathname =
      (typeof body?.pathname === "string" ? body.pathname : undefined) ||
      (typeof rawPayloadObj?.pathname === "string" ? rawPayloadObj.pathname : undefined) ||
      (typeof body?.path === "string" ? body.path : undefined);

    const rawPayload =
      body?.clientPayload ??
      rawPayloadObj?.clientPayload;

    if (!rawPathname) {
      throw new Error("Missing pathname");
    }

    if (!rawPayload) {
      throw new Error("Missing client payload");
    }

    let parsed: { roomCode?: unknown; size?: unknown };
    if (typeof rawPayload === "string") {
      try {
        parsed = JSON.parse(rawPayload);
      } catch {
        throw new Error("Invalid client payload JSON");
      }
    } else if (typeof rawPayload === "object" && rawPayload !== null) {
      parsed = rawPayload as { roomCode?: unknown; size?: unknown };
    } else {
      throw new Error("Invalid client payload format");
    }

    const { roomCode, size } = parsed;

    if (!roomCode || typeof roomCode !== "string" || !isValidRoomCode(roomCode)) {
      throw new Error("Invalid room code");
    }

    if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > 52428800) {
      throw new Error("Invalid size");
    }

    const cleanPathname = rawPathname.startsWith("/") ? rawPathname.slice(1) : rawPathname;
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

    const bucket = getUpstashBucket();
    const signed = await bucket.signedUploadUrl(cleanPathname, {
      contentType: "application/octet-stream",
      size: size + 16,
      expiresIn: "10m",
    });

    const publicUrl =
      (await bucket.publicUrl(cleanPathname)) ||
      signed.url.split("?")[0];

    return NextResponse.json({
      url: signed.url,
      uploadUrl: signed.url,
      publicUrl,
      headers: signed.headers,
      expiresAt: signed.expiresAt,
      clientToken: signed.url,
      type: "blob.generate-client-token",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload error" },
      { status: 400 }
    );
  }
}
