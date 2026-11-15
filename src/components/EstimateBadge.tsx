"use client";

import { Clock } from "lucide-react";
import {
  estimateSeconds,
  formatDuration,
  type ChannelId,
} from "@/lib/transferEstimate";

export interface EstimateBadgeProps {
  channel: ChannelId;
  totalBytes: number;
  frames?: number;
  frameIntervalMs?: number;
  measuredBytesPerSec?: number;
  className?: string;
}

export function EstimateBadge({
  channel,
  totalBytes,
  frames,
  frameIntervalMs,
  measuredBytesPerSec,
  className = "",
}: EstimateBadgeProps) {
  if (!totalBytes || totalBytes <= 0) {
    return null;
  }

  const { seconds, approximate } = estimateSeconds(channel, totalBytes, {
    frames,
    frameIntervalMs,
    measuredBytesPerSec,
  });

  const durationStr = formatDuration(seconds);
  const timeText = approximate ? `~${durationStr} (approx.)` : durationStr;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] font-medium ${className}`}
    >
      <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
      <span>Estimated time: {timeText}</span>
    </div>
  );
}
