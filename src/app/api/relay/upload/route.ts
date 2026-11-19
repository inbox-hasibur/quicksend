import { NextResponse } from "next/server";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codeGenerator";
import { clientIp } from "@/lib/rateLimit";
import { signalStore } from "@/lib/signalStore";
import { getUpstashBucket, isUpstashBlobConfigured } from "@/lib/upstashBlob";
import { RELAY_CHUNK_BYTES } from "@/lib/relayLimits";
import { isValidChunkPath } from "@/lib/relayChunks";

const HOURLY_BYTE_LIMIT = 2 * 1024 * 1024 * 1024; // 2 GiB per hour per IP
const DEFAULT_DAILY_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB default daily budget
const MAX_CHUNKS_PER_REQUEST = 100;

interface ChunkUploadItem {
  path: string;
  size: number;
}

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

  const { roomCode, rid, chunks } = body ?? {};

  if (!roomCode || typeof roomCode !== "string" || !isValidRoomCode(roomCode)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  if (!rid || typeof rid !== "string" || !/^[0-9a-f]{32}$/i.test(rid)) {
    return NextResponse.json({ error: "Invalid rid" }, { status: 400 });
  }

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return NextResponse.json({ error: "Invalid chunks array" }, { status: 400 });
  }

  if (chunks.length > MAX_CHUNKS_PER_REQUEST) {
    return NextResponse.json({ error: "Too many chunks in request" }, { status: 400 });
  }

  const cleanCode = normalizeRoomCode(roomCode);
  let totalRequestBytes = 0;

  for (const chunk of chunks as ChunkUploadItem[]) {
    if (!chunk || typeof chunk !== "object") {
      return NextResponse.json({ error: "Invalid chunk object" }, { status: 400 });
    }

    if (
      typeof chunk.size !== "number" ||
      !Number.isInteger(chunk.size) ||
      chunk.size < 1 ||
      chunk.size > RELAY_CHUNK_BYTES + 16
    ) {
      return NextResponse.json({ error: "Invalid chunk size" }, { status: 400 });
    }

    const validPath =
      isValidChunkPath(chunk.path, roomCode, rid) ||
      isValidChunkPath(chunk.path, cleanCode, rid);

    if (typeof chunk.path !== "string" || !validPath) {
      return NextResponse.json({ error: "Invalid chunk path" }, { status: 400 });
    }

    totalRequestBytes += chunk.size;
  }

  const ip = clientIp(request);

  // Hourly byte limit per IP (600 MB / hour)
  const hourlyKey = `ratelimit:relay:upload-bytes:${ip}`;
  const rawHourly = await signalStore.getKey(hourlyKey);
  const currentHourly = rawHourly ? Number.parseInt(rawHourly, 10) || 0 : 0;
  if (currentHourly + totalRequestBytes > HOURLY_BYTE_LIMIT) {
    return NextResponse.json({ error: "Upload byte limit exceeded" }, { status: 429 });
  }

  // Daily budget key with process.env.RELAY_DAILY_BYTES
  const dailyLimit = process.env.RELAY_DAILY_BYTES
    ? Number.parseInt(process.env.RELAY_DAILY_BYTES, 10) || DEFAULT_DAILY_BYTES
    : DEFAULT_DAILY_BYTES;
  const today = new Date().toISOString().slice(0, 10);
  const budgetKey = `relay-bytes:${today}`;
  const currentDailyRaw = await signalStore.getKey(budgetKey);
  const currentDaily = currentDailyRaw ? Number.parseInt(currentDailyRaw, 10) || 0 : 0;

  if (currentDaily + totalRequestBytes > dailyLimit) {
    return NextResponse.json({ error: "Relay daily limit reached" }, { status: 429 });
  }

  // Update byte usage counters
  if (rawHourly === null || currentHourly === 0) {
    await signalStore.setKey(hourlyKey, String(currentHourly + totalRequestBytes), 3600);
  } else {
    await signalStore.setKey(hourlyKey, String(currentHourly + totalRequestBytes));
  }
  await signalStore.setKey(budgetKey, String(currentDaily + totalRequestBytes), 86400);

  try {
    const bucket = getUpstashBucket();

    const urls = await Promise.all(
      (chunks as ChunkUploadItem[]).map(async (chunk) => {
        const signed = await bucket.signedUploadUrl(chunk.path, {
          contentType: "application/octet-stream",
          expiresIn: "10m",
        });
        return {
          path: chunk.path,
          url: signed.url,
          headers: signed.headers,
        };
      })
    );

    let baseUrl: string | undefined;
    const chunkList = chunks as ChunkUploadItem[];
    if (chunkList.length > 0) {
      try {
        const samplePath = chunkList[0].path;
        const samplePub = await bucket.publicUrl(samplePath);
        if (samplePub) {
          const cleanSample = samplePath.replace(/^\/+/, "");
          const suffix = `/${cleanSample}`;
          if (samplePub.endsWith(suffix)) {
            baseUrl = samplePub.slice(0, -suffix.length);
          } else {
            const idx = samplePub.indexOf(suffix);
            if (idx !== -1) {
              baseUrl = samplePub.slice(0, idx);
            } else {
              try {
                baseUrl = new URL(samplePub).origin;
              } catch {
                baseUrl = undefined;
              }
            }
          }
        }
      } catch (pubErr) {
        console.warn("[Relay Upload] publicUrl derivation notice:", pubErr);
      }
    }
    if (!baseUrl && process.env.UPSTASH_BLOB_URL?.trim()) {
      baseUrl = process.env.UPSTASH_BLOB_URL.trim().replace(/\/+$/, "");
    }

    return NextResponse.json({ urls, baseUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload error" },
      { status: 500 }
    );
  }
}
