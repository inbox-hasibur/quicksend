import { NextResponse } from "next/server";
import { list, del } from "@vercel/blob";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
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
    let cursor: string | undefined = undefined;
    let scanned = 0;
    let deleted = 0;
    const cutoff = Date.now() - STALE_THRESHOLD_MS;

    do {
      const response: Awaited<ReturnType<typeof list>> = await list({
        prefix: "relay/",
        limit: 100,
        cursor,
      });

      const staleUrls: string[] = [];
      for (const blob of response.blobs) {
        scanned++;
        const uploadedTime = new Date(blob.uploadedAt).getTime();
        if (uploadedTime < cutoff) {
          staleUrls.push(blob.url);
        }
      }

      if (staleUrls.length > 0) {
        await del(staleUrls);
        deleted += staleUrls.length;
      }

      cursor = response.hasMore ? response.cursor : undefined;
    } while (cursor);

    return NextResponse.json({ scanned, deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
