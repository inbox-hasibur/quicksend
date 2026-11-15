"use client";

import React from "react";
import type { NearbyPeer } from "@/hooks/useLocalDiscovery";

export interface NearbyPeerCardProps {
  peer: NearbyPeer;
  onPress: () => void;
  disabled?: boolean;
}

export function NearbyPeerCard({ peer, onPress, disabled = false }: NearbyPeerCardProps) {
  const avatarBg = peer.avatarColor || "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
  const osLabel = peer.os || "Device";

  return (
    <button
      type="button"
      role="button"
      onClick={onPress}
      disabled={disabled}
      className="group p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-subtle)] hover:bg-[var(--surface)] border border-[var(--border-hairline)] hover:border-neutral-300 dark:hover:border-neutral-700 shadow-2xs transition-all text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-[var(--border-hairline)] ${avatarBg}`}
        >
          <span>{peer.avatarEmoji || "🦊"}</span>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-xs sm:text-sm text-[var(--text)] truncate">
            {peer.name || "Nearby Peer"}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-muted)]">
              {osLabel}
            </span>
          </div>
        </div>
      </div>

      <span className="text-[11px] font-semibold text-[var(--accent)] group-hover:underline shrink-0">
        Send request
      </span>
    </button>
  );
}
