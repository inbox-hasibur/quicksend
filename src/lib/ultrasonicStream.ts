/**
 * Ultrasonic Acoustic Data Stream Protocol
 * Transmits data through high-frequency sound waves using Frequency Shift Keying (FSK)
 * via Web Audio API oscillators and receives via microphone AnalyserNode FFT.
 */

export interface UltrasonicConfig {
  baseFreq: number; // Base frequency for nibble 0 (e.g. 18000 Hz)
  stepFreq: number; // Frequency separation per nibble (e.g. 100 Hz)
  startFreq: number; // Preamble / Start tone (e.g. 17500 Hz)
  stopFreq: number; // Postamble / Stop tone (e.g. 19800 Hz)
  symbolDurationMs: number; // Duration of each tone (e.g. 80 ms)
}

export const ULTRASONIC_PRESETS = {
  nearUltrasonic: {
    baseFreq: 18000,
    stepFreq: 100,
    startFreq: 17500,
    stopFreq: 19800,
    symbolDurationMs: 85,
  } satisfies UltrasonicConfig,
  audibleChirp: {
    baseFreq: 1600,
    stepFreq: 80,
    startFreq: 1400,
    stopFreq: 3000,
    symbolDurationMs: 90,
  } satisfies UltrasonicConfig,
};

/**
 * Converts a text string into an array of hexadecimal nibbles (0-15).
 */
export function textToNibbles(text: string): number[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const nibbles: number[] = [];

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    nibbles.push((byte >> 4) & 0x0f); // High nibble
    nibbles.push(byte & 0x0f); // Low nibble
  }

  return nibbles;
}

/**
 * Converts an array of hexadecimal nibbles (0-15) back into a text string.
 */
export function nibblesToText(nibbles: number[]): string {
  if (nibbles.length < 2) return "";
  const bytes: number[] = [];

  const evenLength = nibbles.length - (nibbles.length % 2);
  for (let i = 0; i < evenLength; i += 2) {
    const high = nibbles[i] & 0x0f;
    const low = nibbles[i + 1] & 0x0f;
    bytes.push((high << 4) | low);
  }

  try {
    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    return "";
  }
}

/**
 * Maps a nibble (0-15) to its target frequency.
 */
export function nibbleToFrequency(nibble: number, config: UltrasonicConfig): number {
  return config.baseFreq + (nibble & 0x0f) * config.stepFreq;
}

/**
 * Maps a frequency in Hz back to a nibble (0-15), or null if not within tolerance.
 */
export function frequencyToNibble(
  freq: number,
  config: UltrasonicConfig,
  tolerance = 45
): number | null {
  for (let i = 0; i < 16; i++) {
    const target = nibbleToFrequency(i, config);
    if (Math.abs(freq - target) <= tolerance) {
      return i;
    }
  }
  return null;
}

/**
 * Determines whether a frequency corresponds to the start or stop tone.
 */
export function classifyTone(
  freq: number,
  config: UltrasonicConfig,
  tolerance = 45
): "start" | "stop" | "data" | "unknown" {
  if (Math.abs(freq - config.startFreq) <= tolerance) {
    return "start";
  }
  if (Math.abs(freq - config.stopFreq) <= tolerance) {
    return "stop";
  }
  if (frequencyToNibble(freq, config, tolerance) !== null) {
    return "data";
  }
  return "unknown";
}
