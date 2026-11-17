import { NextResponse } from "next/server";

export async function GET() {
  const available = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

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
