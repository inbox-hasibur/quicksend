/**
 * Generates a random 6-digit numerical room PIN.
 */
export function generateRoomCode(): string {
  // Generates integer between 100000 and 999999
  const randomValue = Math.floor(100000 + Math.random() * 900000);
  return randomValue.toString();
}

/**
 * Formats a 6-character room code with a human-readable hyphen: e.g. 834291 -> 834-291
 */
export function formatRoomCode(code: string): string {
  const clean = normalizeRoomCode(code);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

/**
 * Normalizes user input by stripping spaces, hyphens, and non-alphanumeric characters.
 */
export function normalizeRoomCode(input: string): string {
  if (!input) return "";
  return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Validates whether an input represents a valid 6-character room PIN.
 */
export function isValidRoomCode(input: string): boolean {
  const clean = normalizeRoomCode(input);
  return clean.length === 6;
}
