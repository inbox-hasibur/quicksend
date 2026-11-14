"use client";

import React, { KeyboardEvent } from "react";

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * Segmented control with soft glass track and keyboard arrow navigation.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps) {
  // Handle arrow key navigation between tabs
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (options.length === 0) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % options.length;
      onChange(options[nextIndex].value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + options.length) % options.length;
      onChange(options[prevIndex].value);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex p-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-glass)] backdrop-blur-md shadow-xs"
    >
      {options.map((opt, idx) => {
        const isActive = opt.value === value;

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`pill px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              isActive
                ? "pill-active shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
