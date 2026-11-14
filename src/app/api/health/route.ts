import { NextResponse } from "next/server";
import { signalStore } from "@/lib/signalStore";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "quicksend",
    storage: signalStore.getStorageMode(),
    timestamp: Date.now(),
  });
}
