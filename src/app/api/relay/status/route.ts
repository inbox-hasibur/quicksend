import { NextResponse } from "next/server";
import { isUpstashBlobConfigured } from "@/lib/upstashBlob";
import {
  RELAY_CHUNK_BYTES,
  RELAY_MAX_FILE_BYTES,
  RELAY_MAX_TRANSFER_BYTES,
  RELAY_MAX_FILES,
  RELAY_TTL_MINUTES,
} from "@/lib/relayLimits";

export async function GET() {
  const available = isUpstashBlobConfigured();

  return NextResponse.json(
    {
      available,
      maxFileBytes: RELAY_MAX_FILE_BYTES,
      maxTransferBytes: RELAY_MAX_TRANSFER_BYTES,
      maxFiles: RELAY_MAX_FILES,
      chunkBytes: RELAY_CHUNK_BYTES,
      ttlMinutes: RELAY_TTL_MINUTES,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
