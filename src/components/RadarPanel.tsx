"use client";

import React from "react";
import {
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Send,
  AlertCircle,
} from "lucide-react";
import type { NearbyPeer } from "@/hooks/useLocalDiscovery";

export interface RadarIdentity {
  name: string;
  codename?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  os?: string;
  browser?: string;
  formFactor?: string;
}

export interface RadarPanelProps {
  title?: string;
  statusText?: string;
  emptyText?: string;
  myIdentity: RadarIdentity;
  peers: NearbyPeer[];
  selectedPeerId?: string | null;
  onBeam: (peer: NearbyPeer) => void;
  onChangeAvatar?: () => void;
  error?: string | null;
  banner?: React.ReactNode;
  className?: string;
}

function getDeviceIcon(formFactor?: string, className = "w-4 h-4") {
  switch (formFactor) {
    case "mobile":
      return <Smartphone className={className} />;
    case "tablet":
      return <Tablet className={className} />;
    case "desktop":
      return <Monitor className={className} />;
    default:
      return <Laptop className={className} />;
  }
}

export function RadarPanel({
  title,
  statusText,
  emptyText = "Scanning local router... Open QuickSend on another device to appear.",
  myIdentity,
  peers,
  selectedPeerId,
  onBeam,
  onChangeAvatar,
  error,
  banner,
  className = "",
}: RadarPanelProps) {
  const displayTitle = title ?? `Nearby Devices (${peers.length})`;
  const displayStatus =
    statusText ?? (peers.length > 0 ? "Local Network Synced" : "Scanning local router...");

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Optional Top Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Optional Custom Beam or Status Banner */}
      {banner}

      {/* Header with Title and Pulse Indicator */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--text)]">
          {displayTitle}
        </label>
        <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{displayStatus}</span>
        </span>
      </div>

      {/* Radar Discovery Screen Viewport */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] min-h-[300px] max-h-[420px] bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-3xl overflow-hidden flex items-center justify-center p-6 shadow-inner">
        {/* Radar Concentric Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[180px] sm:w-[220px] h-[180px] sm:h-[220px] rounded-full border border-neutral-300/80 dark:border-neutral-700/60" />
          <div className="absolute w-[290px] sm:w-[350px] h-[290px] sm:h-[350px] rounded-full border border-neutral-300/50 dark:border-neutral-700/40" />
          <div className="absolute w-[400px] sm:w-[480px] h-[400px] sm:h-[480px] rounded-full border border-neutral-300/30 dark:border-neutral-700/20" />
        </div>

        {/* Sweeping Radar Scanner Line */}
        <div className="absolute w-[400px] sm:w-[480px] h-[400px] sm:h-[480px] rounded-full pointer-events-none animate-radar-sweep overflow-hidden">
          <div
            className="w-1/2 h-1/2 origin-bottom-right"
            style={{
              background:
                "conic-gradient(from 0deg at 100% 100%, rgba(99, 102, 241, 0.22) 0deg, transparent 70deg)",
            }}
          />
        </div>

        {/* Center Node (This Device Identity) */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-14 h-14 rounded-full bg-[var(--accent)]/15 animate-radar-ping pointer-events-none" />
            <button
              type="button"
              onClick={onChangeAvatar}
              title="Tap to change your avatar"
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md text-white border-2 border-white dark:border-neutral-800 text-2xl select-none hover:scale-110 active:scale-95 transition-all cursor-pointer group"
              style={{ backgroundColor: myIdentity.avatarColor || "#6366F1" }}
            >
              <span className="group-hover:rotate-12 transition-transform">
                {myIdentity.avatarEmoji || "🦊"}
              </span>
            </button>
          </div>
          <div className="mt-2">
            <span className="text-xs font-bold text-[var(--text)] block truncate max-w-[140px]">
              {myIdentity.codename || myIdentity.name}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
              You ({myIdentity.os || "Device"} • {myIdentity.browser || "Online"})
            </span>
            {onChangeAvatar && (
              <button
                type="button"
                onClick={onChangeAvatar}
                className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer mt-0.5"
              >
                Change avatar
              </button>
            )}
          </div>
        </div>

        {/* Discovered Nearby Peers Positioned Around Radar */}
        {peers.length > 0 ? (
          <div className="absolute inset-0 p-4 sm:p-6 pointer-events-none flex flex-wrap items-center justify-around gap-4">
            {peers.map((peer, idx) => {
              const isSelected = selectedPeerId === peer.id;
              return (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => onBeam(peer)}
                  className={`pointer-events-auto group relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 ${
                    isSelected
                      ? "bg-[var(--accent)] text-[var(--surface)] border-[var(--accent)] shadow-md"
                      : "bg-[var(--surface)] text-[var(--text)] border-[var(--border-hairline)] hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                  style={{
                    transform: `rotate(${idx * 75}deg) translateY(-85px) rotate(-${idx * 75}deg)`,
                  }}
                  title={`Send payload to ${peer.codename || peer.name}`}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-xl select-none shrink-0 shadow-xs border border-white/20 text-white"
                    style={{ backgroundColor: peer.avatarColor || "#6366F1" }}
                  >
                    {peer.avatarEmoji || "💻"}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold truncate max-w-[120px]">
                      {peer.codename || peer.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-medium flex items-center gap-1">
                      {getDeviceIcon(peer.formFactor, "w-3 h-3")}
                      <span>
                        {peer.os || "Device"} ({peer.browser || "Online"})
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Tap to Send
                    </div>
                  </div>
                  <Send className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity ml-1" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="absolute bottom-4 inset-x-4 text-center pointer-events-none">
            <p className="text-[11px] text-[var(--text-muted)] bg-[var(--surface)]/90 backdrop-blur-xs py-1.5 px-3 rounded-full border border-[var(--border-hairline)] inline-block shadow-xs">
              {emptyText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RadarPanel;
