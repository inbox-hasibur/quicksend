"use client";

import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

export interface NearbyPairRequestModalProps {
  peerName: string;
  peerAvatar?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function NearbyPairRequestModal({
  peerName,
  peerAvatar = "🦊",
  onAccept,
  onDecline,
}: NearbyPairRequestModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(45);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onDecline();
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, onDecline]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pair-request-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl space-y-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-3xl mx-auto shadow-2xs">
          <span>{peerAvatar}</span>
        </div>

        <div className="space-y-1">
          <h3 id="pair-request-title" className="font-bold text-base text-[var(--text)]">
            {peerName} wants to connect
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Accept connection to receive incoming files directly.
          </p>
        </div>

        {/* 45s countdown progress */}
        <div className="space-y-1.5">
          <div className="w-full bg-[var(--surface-subtle)] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[var(--accent)] h-full transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(secondsRemaining / 45) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-[var(--text-muted)] font-mono">
            Auto-declining in {secondsRemaining}s
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onDecline}
            className="py-2.5 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 text-xs font-semibold text-[var(--text)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Decline</span>
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
