"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Globe,
  Wifi,
  Smartphone,
  Bluetooth,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import type { TransferMode, ModeStatus } from "@/types/mode";
import { useBrowserCapabilities } from "@/hooks/useNetworkStatus";
import { getAllModesStatus } from "@/lib/modeAvailability";
import { InternetSharingCard } from "@/components/InternetSharingCard";
import { SameNetworkCard } from "@/components/SameNetworkCard";
import { HotspotAssistantCard } from "@/components/HotspotAssistantCard";
import { NearbyShareCard } from "@/components/NearbyShareCard";

export function ModeSelector() {
  const searchParams = useSearchParams();
  const initialRoomCode = searchParams.get("room") || undefined;

  const capabilities = useBrowserCapabilities();
  const modes: ModeStatus[] = getAllModesStatus(capabilities);
  const [selectedMode, setSelectedMode] = useState<TransferMode | null>(
    initialRoomCode ? "internet" : null
  );

  const getModeTheme = (mode: TransferMode) => {
    switch (mode) {
      case "internet":
        return {
          icon: <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
          bg: "bg-indigo-50 dark:bg-indigo-950/40",
          tag: "Global Relay",
          tagBg: "bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60",
          summary: "PIN, Mobile Number, or QR Code",
        };
      case "same-network":
        return {
          icon: <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
          bg: "bg-emerald-50 dark:bg-emerald-950/40",
          tag: "Fast Local LAN",
          tagBg: "bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60",
          summary: "Direct high-speed local network beam",
        };
      case "hotspot":
        return {
          icon: <Smartphone className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
          bg: "bg-amber-50 dark:bg-amber-950/40",
          tag: "Offline PWA",
          tagBg: "bg-amber-50/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60",
          summary: "Zero-internet phone hotspot & QR",
        };
      case "bluetooth":
        return {
          icon: <Bluetooth className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
          bg: "bg-blue-50 dark:bg-blue-950/40",
          tag: "Proximity",
          tagBg: "bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60",
          summary: "Quick Share, AirDrop & BLE Hardware",
        };
    }
  };

  const activeModeDetails = modes.find((m) => m.mode === selectedMode);

  return (
    <div className="w-full max-w-4xl">
      {/* 1. COMPACT MODES SELECTION (Clean option tiles inspired by modern apps) */}
      {!selectedMode ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Choose Sharing Channel
            </span>
            <span className="text-xs text-neutral-400 font-mono">4 Modes Available</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {modes.map((item) => {
              const theme = getModeTheme(item.mode);
              const isDisabled = !item.isAvailable;

              return (
                <div
                  key={item.mode}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  onClick={() => {
                    if (!isDisabled) setSelectedMode(item.mode);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                      setSelectedMode(item.mode);
                    }
                  }}
                  className={`group relative flex items-center justify-between p-4 sm:p-5 rounded-3xl border transition-all text-left ${
                    isDisabled
                      ? "opacity-55 cursor-not-allowed bg-neutral-100/70 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800"
                      : "bg-white dark:bg-[#14151B] border-neutral-200/60 dark:border-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] hover:border-neutral-300 dark:hover:border-neutral-700 cursor-pointer active:scale-[0.99]"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Squircle Icon */}
                    <div
                      className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ${theme.bg} transition-transform group-hover:scale-105`}
                    >
                      {theme.icon}
                    </div>

                    {/* Mode Info */}
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 truncate">
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {theme.summary}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Status Pill & Arrow Pill */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        isDisabled
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/70"
                          : theme.tagBg
                      }`}
                    >
                      {isDisabled ? "Offline" : theme.tag}
                    </span>

                    <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 group-hover:translate-x-0.5 transition-all">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 2. DEDICATED MODE WORKSPACE (Next Page View with Clean Header & Back Navigation) */
        activeModeDetails && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Top Navigation & Back Pill */}
            <div className="flex items-center justify-between pb-2 px-1">
              <button
                type="button"
                onClick={() => setSelectedMode(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-[#14151B] border border-neutral-200/70 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 shadow-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-neutral-500" />
                <span>All Modes</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-neutral-400 hidden sm:inline">
                  Active Mode:
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                  {getModeTheme(selectedMode).icon}
                  <span className="font-semibold">{activeModeDetails.name}</span>
                </span>
              </div>
            </div>

            {/* Mode Workspace Container */}
            <div className="rounded-3xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-[#14151B] p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
              {selectedMode === "internet" && (
                <InternetSharingCard initialRoomCode={initialRoomCode} />
              )}

              {selectedMode === "same-network" && <SameNetworkCard />}

              {selectedMode === "hotspot" && <HotspotAssistantCard />}

              {selectedMode === "bluetooth" && <NearbyShareCard />}
            </div>
          </div>
        )
      )}
    </div>
  );
}
