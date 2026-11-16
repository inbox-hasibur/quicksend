"use client";

import type { KeyboardEvent } from "react";

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
 * Segmented control matching the tactile reference image:
 * Soft neutral pill track with pure white elevated active tab and subtle shadow.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps) {
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
      className="inline-flex p-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)]"
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
            className={`pill px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              isActive
                ? "pill-active bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
