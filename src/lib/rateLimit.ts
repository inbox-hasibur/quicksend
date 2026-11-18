import { signalStore } from "@/lib/signalStore";

/**
 * Extracts client IP from x-forwarded-for or fallback headers, defaulting to "unknown".
 */
export function clientIp(request: Request): string {
  const header =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip");
  if (!header) return "unknown";
  const first = header.split(",")[0].trim();
  return first || "unknown";
}

/**
 * Rate limit check using signalStore generic key storage with sliding TTL.
 * Returns true when the limit is exceeded.
 */
export async function hitLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const raw = await signalStore.getKey(key);
  let count = 0;
  if (typeof raw === "number") {
    count = raw;
  } else if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    count = Number.isNaN(parsed) ? 0 : parsed;
  }

  if (count >= limit) {
    return true;
  }

  if (raw === null || count === 0) {
    await signalStore.setKey(key, "1", windowSeconds);
  } else {
    await signalStore.setKey(key, String(count + 1));
  }
  return false;
}
