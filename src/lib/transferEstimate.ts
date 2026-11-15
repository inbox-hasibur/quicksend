/**
 * Transfer Time Estimation Utilities for QuickSend Channels.
 */

export type ChannelId =
  | "internet"
  | "same-network"
  | "hotspot"
  | "bluetooth"
  | "camera"
  | "cable";

/**
 * Baseline default throughput in bytes/second for each channel.
 * internet: 1.5 MB/s
 * same-network: 15 MB/s
 * hotspot: 6 MB/s
 * bluetooth: 0.8 MB/s
 * cable: 40 MB/s
 */
export const DEFAULT_CHANNEL_SPEEDS_BYTES_PER_SEC: Record<Exclude<ChannelId, "camera">, number> = {
  internet: 1.5 * 1024 * 1024,
  "same-network": 15 * 1024 * 1024,
  hotspot: 6 * 1024 * 1024,
  bluetooth: 0.8 * 1024 * 1024,
  cable: 40 * 1024 * 1024,
};

export interface EstimateOptions {
  measuredBytesPerSec?: number;
  frames?: number;
  frameIntervalMs?: number;
  framesPerTick?: number;
}

export interface EstimateResult {
  seconds: number;
  approximate: boolean;
}

/**
 * Estimates total chunks/frames for optical camera transfer.
 */
export function estimateCameraFrames(totalBytes: number, chunkRawBytes = 150): number {
  if (totalBytes <= 0) return 0;
  return Math.max(1, Math.ceil(totalBytes / chunkRawBytes));
}

/**
 * Computes payload byte size from files array and optional text snippet.
 */
export function getPayloadBytes(files: File[], text?: string): number {
  const fileBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const textBytes = text ? new TextEncoder().encode(text).length : 0;
  return fileBytes + textBytes;
}

/**
 * Calculates transfer time estimation in seconds for a given channel and payload size.
 */
export function estimateSeconds(
  channel: ChannelId,
  totalBytes: number,
  opts?: EstimateOptions
): EstimateResult {
  if (totalBytes <= 0) {
    return { seconds: 0, approximate: false };
  }

  // 1. Live measured speed override
  if (opts?.measuredBytesPerSec && opts.measuredBytesPerSec > 0) {
    const rawSeconds = totalBytes / opts.measuredBytesPerSec;
    return {
      seconds: rawSeconds,
      approximate: false,
    };
  }

  // 2. Camera optical transfer
  if (channel === "camera") {
    const frameIntervalMs = opts?.frameIntervalMs ?? 320;
    const framesCount = opts?.frames ?? estimateCameraFrames(totalBytes, 150);
    const framesPerTick = Math.max(1, opts?.framesPerTick ?? 1);
    const cameraSeconds = (Math.ceil(framesCount / framesPerTick) * frameIntervalMs) / 1000;
    return {
      seconds: cameraSeconds,
      approximate: true,
    };
  }

  // 3. Default network channel speeds + 1 second fixed handshake overhead
  const speed = DEFAULT_CHANNEL_SPEEDS_BYTES_PER_SEC[channel];
  const networkSeconds = totalBytes / speed + 1; // 1s fixed handshake overhead
  return {
    seconds: networkSeconds,
    approximate: true,
  };
}

/**
 * Formats duration in seconds to human-readable strings.
 * e.g. "under 1 sec", "12 sec", "3 min 20 sec", "1 hr 5 min"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) {
    return "under 1 sec";
  }

  const rounded = Math.round(seconds);
  if (rounded < 60) {
    return `${rounded} sec`;
  }

  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;

  if (rounded < 3600) {
    if (secs === 0) return `${mins} min`;
    return `${mins} min ${secs} sec`;
  }

  const hours = Math.floor(rounded / 3600);
  const remainingMins = Math.round((rounded % 3600) / 60);
  if (remainingMins === 0) return `${hours} hr`;
  if (remainingMins === 60) return `${hours + 1} hr`;
  return `${hours} hr ${remainingMins} min`;
}
