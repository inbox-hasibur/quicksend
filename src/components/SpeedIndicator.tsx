"use client";

import { Gauge } from "lucide-react";

export interface SpeedIndicatorProps {
  speedBars: number;
  total?: number;
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
}

export function getSpeedColorClass(speedBars: number): string {
  if (speedBars >= 5) return "bg-emerald-500 dark:bg-emerald-400";
  if (speedBars === 4) return "bg-indigo-500 dark:bg-indigo-400";
  if (speedBars === 3) return "bg-blue-500 dark:bg-blue-400";
  return "bg-amber-500 dark:bg-amber-400";
}

export function SpeedIndicator({
  speedBars,
  total = 5,
  className = "",
  showIcon = true,
  showLabel = true,
}: SpeedIndicatorProps) {
  const activeColor = getSpeedColorClass(speedBars);
  const heights = ["32%", "48%", "64%", "82%", "100%"];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--surface-subtle)] border border-[var(--border-hairline)] shadow-2xs select-none ${className}`}
      title={`Transfer Speed Rating: ${speedBars} of ${total}`}
    >
      {showIcon && (
        <Gauge
          className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0"
          aria-hidden="true"
        />
      )}
      {showLabel && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
          Speed
        </span>
      )}
      <div
        className="flex items-end gap-[3px] h-3.5"
        role="meter"
        aria-valuenow={speedBars}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Speed rating ${speedBars} of ${total}`}
      >
        {Array.from({ length: total }, (_, i) => {
          const isFilled = i < speedBars;
          return (
            <div
              key={i}
              data-testid={`speed-segment-${i}`}
              data-filled={isFilled ? "true" : "false"}
              style={{ height: heights[i] || "100%" }}
              className={`w-1 rounded-xs transition-colors ${
                isFilled
                  ? activeColor
                  : "bg-[var(--border-hairline)] opacity-40"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
