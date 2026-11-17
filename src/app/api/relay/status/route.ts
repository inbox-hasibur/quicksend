import { NextResponse } from "next/server";
import { isUpstashBlobConfigured } from "@/lib/upstashBlob";

export async function GET() {
  const available = isUpstashBlobConfigured();

  return NextResponse.json(
    {
      available,
      maxFileBytes: 52428800, // 50 MB
      maxFiles: 5,
      ttlMinutes: 15,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
