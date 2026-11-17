import { signalStore } from "@/lib/signalStore";

/**
 * Extracts client IP from x-forwarded-for header, fallback to "unknown".
 */
export function clientIp(request: Request): string {
  const header = request.headers.get("x-forwarded-for");
  if (!header) return "unknown";
  const first = header.split(",")[0].trim();
  return first || "unknown";
}

/**
 * Rate limit check using signalStore generic key storage with TTL.
 * Returns true when the limit is exceeded.
 */
export async function hitLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const raw = await signalStore.getKey(key);
  const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
  if (count >= limit) {
    return true;
  }
  await signalStore.setKey(key, String(count + 1), windowSeconds);
  return false;
}
