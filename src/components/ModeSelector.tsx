"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Globe,
  Wifi,
  Smartphone,
  Bluetooth,
  Camera,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { TransferMode, ModeStatus } from "@/types/mode";
import { useBrowserCapabilities } from "@/hooks/useNetworkStatus";
import { getAllModesStatus } from "@/lib/modeAvailability";
import { InternetSharingCard } from "@/components/InternetSharingCard";
import { SameNetworkCard } from "@/components/SameNetworkCard";
import { HotspotAssistantCard } from "@/components/HotspotAssistantCard";
import { NearbyShareCard } from "@/components/NearbyShareCard";
import { CameraStreamCard } from "@/components/CameraStreamCard";

export function ModeSelector() {
  const searchParams = useSearchParams();
  const initialRoomCode = searchParams.get("room") || undefined;

  const capabilities = useBrowserCapabilities();
  const modes: ModeStatus[] = getAllModesStatus(capabilities);
  const [selectedModeOverride, setSelectedModeOverride] = useState<TransferMode | "home" | null>(null);
  const selectedMode =
    selectedModeOverride === "home"
      ? null
      : selectedModeOverride || (initialRoomCode ? "internet" : null);

  const handleSelectMode = (mode: TransferMode | null) => {
    setSelectedModeOverride(mode === null ? "home" : mode);
  };

  const getModeTheme = (mode: TransferMode) => {
    switch (mode) {
      case "internet":
        return {
          displayName: "Via Internet",
          icon: <Globe className="h-5 w-5" />,
          tag: "Global Relay",
          summary: "Send or receive via 6-digit PIN, mobile number, or QR code across any network.",
        };
      case "same-network":
        return {
          displayName: "Same Wi-Fi",
          icon: <Wifi className="h-5 w-5" />,
          tag: "Local LAN",
          summary: "Ultra-fast direct transfer between devices sharing the same Wi-Fi router.",
        };
      case "hotspot":
        return {
          displayName: "Wi-Fi Hotspot",
          icon: <Smartphone className="h-5 w-5" />,
          tag: "Offline PWA",
          summary: "Zero-internet transfer using phone hotspot and camera-to-camera optical QR.",
        };
      case "bluetooth":
        return {
          displayName: "Nearby & Bluetooth",
          icon: <Bluetooth className="h-5 w-5" />,
          tag: "Proximity",
          summary: "Quick Share, AirDrop, and Web-BLE hardware client for adjacent devices.",
        };
      case "camera":
        return {
          displayName: "Via Camera",
          icon: <Camera className="h-5 w-5" />,
          tag: "Air-Gapped",
          summary: "Zero-network transfer. Stream files as animated QR codes scanned by opposite camera.",
        };
    }
  };

  const activeModeDetails = modes.find((m) => m.mode === selectedMode);

  return (
    <div className="w-full max-w-4xl">
      {!selectedMode ? (
        /* 1. CLEAN HOME HUB: 5 OPTION CARDS */
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-[var(--border-hairline)]">
            <div>
              <h2 className="font-bold text-lg sm:text-xl text-[var(--text)] tracking-tight">
                Select Transfer Channel
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Choose the best method for your current physical and network environment
              </p>
            </div>
            <span className="text-[11px] font-mono font-medium text-[var(--text-muted)]">
              {modes.length} Channels Available
            </span>
          </div>

          {/* 5 Cards Grid - Soft rounded tactile cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modes.map((item) => {
              const theme = getModeTheme(item.mode);
              const isDisabled = !item.isAvailable;

              return (
                <div
                  key={item.mode}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  onClick={() => {
                    if (!isDisabled) handleSelectMode(item.mode);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                      handleSelectMode(item.mode);
                    }
                  }}
                  className={`group p-5 sm:p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] transition-all flex flex-col justify-between text-left ${
                    isDisabled
                      ? "opacity-55 cursor-not-allowed"
                      : "cursor-pointer hover:bg-[#ECEEF2] dark:hover:bg-[#212534] hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-xs active:scale-[0.99]"
                  }`}
                >
                  <div>
                    {/* Top Row: Squircle Icon + Status Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-11 w-11 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs flex items-center justify-center text-neutral-800 dark:text-neutral-200 group-hover:scale-105 transition-transform">
                        {theme.icon}
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                          isDisabled
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/70"
                            : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700/80"
                        }`}
                      >
                        {isDisabled ? "Needs Internet" : theme.tag}
                      </span>
                    </div>

                    {/* Mode Title & Summary */}
                    <h3 className="font-bold text-base text-[var(--text)] mt-4">
                      {theme.displayName}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                      {theme.summary}
                    </p>
                  </div>

                  {/* Bottom Row: Clear Action Indicator */}
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] group-hover:text-[var(--text)] mt-5 pt-3 border-t border-neutral-200/50 dark:border-neutral-800/80 transition-colors">
                    <span>{isDisabled ? "Currently Unavailable" : "Open Channel"}</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 2. DEDICATED FOCUSED WORKSPACE */
        activeModeDetails && (
          <div className="glass-card p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
            {/* Top Workspace Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => handleSelectMode(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-subtle)] hover:bg-neutral-200/70 dark:hover:bg-neutral-750 border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text)] transition-all cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span>All Channels</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                  Active Channel:
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text)]">
                  {getModeTheme(selectedMode).icon}
                  <span>{getModeTheme(selectedMode).displayName}</span>
                </span>
              </div>
            </div>

            {/* Mode Workspace Content */}
            <div>
              {selectedMode === "internet" && (
                <InternetSharingCard initialRoomCode={initialRoomCode} />
              )}

              {selectedMode === "same-network" && <SameNetworkCard />}

              {selectedMode === "camera" && <CameraStreamCard />}

              {selectedMode === "hotspot" && <HotspotAssistantCard />}

              {selectedMode === "bluetooth" && <NearbyShareCard />}
            </div>
          </div>
        )
      )}
    </div>
  );
}
