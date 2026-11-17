import { NextResponse } from "next/server";
import { getUpstashBucket, isUpstashBlobConfigured } from "@/lib/upstashBlob";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(request: Request) {
  if (!isUpstashBlobConfigured()) {
    return NextResponse.json({ scanned: 0, deleted: 0 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const bucket = getUpstashBucket();
    let cursor: string | undefined = undefined;
    let scanned = 0;
    let deleted = 0;
    const cutoff = Date.now() - STALE_THRESHOLD_MS;

    do {
      const page = await bucket.list({
        prefix: "relay/",
        limit: 100,
        cursor,
      });

      const stalePaths: string[] = [];
      for (const blob of page.blobs) {
        scanned++;
        const uploadedTime = new Date(blob.uploadedAt).getTime();
        if (uploadedTime < cutoff) {
          stalePaths.push(blob.path);
        }
      }

      if (stalePaths.length > 0) {
        await bucket.del(stalePaths.length === 1 ? stalePaths[0] : stalePaths);
        deleted += stalePaths.length;
      }

      cursor = page.cursor;
    } while (cursor);

    return NextResponse.json({ scanned, deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
