/**
 * Generates a random 6-digit numerical room PIN.
 */
export function generateRoomCode(): string {
  // Generates integer between 100000 and 999999
  const randomValue = Math.floor(100000 + Math.random() * 900000);
  return randomValue.toString();
}

/**
 * Formats a room code:
 * - 6-digit PIN: 834291 -> 834-291
 * - Mobile numbers or custom keywords (e.g. HR998877, 01712345678): preserved cleanly
 */
export function formatRoomCode(code: string): string {
  const clean = normalizeRoomCode(code);
  if (/^\d{6}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
  }
  return clean;
}

/**
 * Extracts a room code from a raw string, URL, or query parameter.
 * Handles inputs like "https://quicksend.vercel.app/?room=834291", "/?room=834291", or bare keys.
 */
function extractRoomCodeFromUrl(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  try {
    if (trimmed.includes("room=") || trimmed.includes("code=") || trimmed.includes("pin=")) {
      const match = trimmed.match(/[?&](?:room|code|pin)=([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const param = url.searchParams.get("room") || url.searchParams.get("code") || url.searchParams.get("pin");
      if (param) return param;
    }
  } catch {
    // Ignore URL parsing fallback
  }
  return trimmed;
}

/**
 * Normalizes user input by stripping spaces, hyphens, and non-alphanumeric characters.
 * Automatically extracts room codes from pasted URLs or scanned QR links.
 */
export function normalizeRoomCode(input: string): string {
  if (!input) return "";
  const extracted = extractRoomCodeFromUrl(input);
  return extracted.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Validates whether an input represents a valid room key (PIN, Mobile Number, or Keyword).
 * Accepts any alphanumeric string between 4 and 20 characters.
 */
export function isValidRoomCode(input: string): boolean {
  const clean = normalizeRoomCode(input);
  return clean.length >= 4 && clean.length <= 20;
}
