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
 * Normalizes user input by stripping spaces, hyphens, and non-alphanumeric characters.
 */
export function normalizeRoomCode(input: string): string {
  if (!input) return "";
  return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Validates whether an input represents a valid room key (PIN, Mobile Number, or Keyword).
 * Accepts any alphanumeric string between 4 and 20 characters.
 */
export function isValidRoomCode(input: string): boolean {
  const clean = normalizeRoomCode(input);
  return clean.length >= 4 && clean.length <= 20;
}
