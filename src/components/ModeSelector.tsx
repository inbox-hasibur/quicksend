"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Globe,
  Wifi,
  Smartphone,
  Bluetooth,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import type { TransferMode, ModeStatus, TransferRole } from "@/types/mode";
import { isValidRoomCode } from "@/lib/codeGenerator";
import { useBrowserCapabilities } from "@/hooks/useNetworkStatus";
import { getAllModesStatus } from "@/lib/modeAvailability";
import { InternetSharingCard } from "@/components/InternetSharingCard";
import { SameNetworkCard } from "@/components/SameNetworkCard";
import { HotspotAssistantCard } from "@/components/HotspotAssistantCard";
import { NearbyShareCard } from "@/components/NearbyShareCard";
import { BottomNav, type BottomNavItem } from "@/components/BottomNav";
import { TransferHistoryModal } from "@/components/TransferHistoryModal";
import { useTransferHistory } from "@/hooks/useTransferHistory";

export function ModeSelector() {
  const searchParams = useSearchParams();
  const initialRoomCode = searchParams.get("room") || undefined;

  const capabilities = useBrowserCapabilities();
  const modes: ModeStatus[] = getAllModesStatus(capabilities);
  const [selectedMode, setSelectedMode] = useState<TransferMode | null>(
    initialRoomCode ? "internet" : null
  );

  const isInitialReceive = Boolean(initialRoomCode && isValidRoomCode(initialRoomCode));
  const [activeRole, setActiveRole] = useState<TransferRole>(isInitialReceive ? "receive" : "send");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { history, clearHistory } = useTransferHistory();

  // Navigation handlers
  const handleHome = () => {
    setSelectedMode(null);
    setIsHistoryOpen(false);
  };

  const handleSend = () => {
    setIsHistoryOpen(false);
    setActiveRole("send");
    setSelectedMode("internet");
  };

  const handleReceive = () => {
    setIsHistoryOpen(false);
    setActiveRole("receive");
    setSelectedMode("internet");
  };

  const handleHistory = () => {
    setIsHistoryOpen(true);
  };

  // Sync role selection with InternetSharingCard's SegmentedControl
  useEffect(() => {
    if (selectedMode !== "internet") return;

    const roleContainer = document.querySelector('[aria-label="Transfer Role"]');
    if (roleContainer) {
      const buttons = roleContainer.querySelectorAll('button[role="tab"]');
      buttons.forEach((btn) => {
        const text = btn.textContent?.trim().toLowerCase();
        if (text === activeRole && btn.getAttribute("aria-selected") !== "true") {
          (btn as HTMLButtonElement).click();
        }
      });
    }

    const handleRoleTabClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('button[role="tab"]');
      if (!target) return;
      const container = target.closest('[aria-label="Transfer Role"]');
      if (!container) return;
      const text = target.textContent?.trim().toLowerCase();
      if (text === "send" || text === "receive") {
        setActiveRole(text as TransferRole);
      }
    };

    document.addEventListener("click", handleRoleTabClick);
    return () => {
      document.removeEventListener("click", handleRoleTabClick);
    };
  }, [selectedMode, activeRole]);

  // Active item determination for BottomNav
  let activeBottomItem: BottomNavItem | undefined = undefined;
  if (isHistoryOpen) {
    activeBottomItem = "history";
  } else if (selectedMode === null) {
    activeBottomItem = "home";
  } else if (selectedMode === "internet") {
    activeBottomItem = activeRole === "receive" ? "receive" : "send";
  }

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
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
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
                  className={`group relative flex items-center justify-between p-4 sm:p-5 glass-card transition-all text-left ${
                    isDisabled
                      ? "opacity-55 cursor-not-allowed"
                      : "cursor-pointer active:scale-[0.99] hover:border-[var(--accent)]"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Squircle icon box with accent-soft background */}
                    <div className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center bg-[var(--accent-soft)] transition-transform group-hover:scale-105">
                      {theme.icon}
                    </div>

                    {/* Mode Info */}
                    <div className="min-w-0 pr-2">
                      <h3 className="font-bold text-sm sm:text-base text-[var(--text)] truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
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

                    <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--text)] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 group-hover:translate-x-0.5 transition-all">
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
                onClick={handleHome}
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

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeItem={activeBottomItem}
        onHome={handleHome}
        onSend={handleSend}
        onReceive={handleReceive}
        onHistory={handleHistory}
      />

      {/* Transfer History Modal */}
      <TransferHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onClear={clearHistory}
      />
    </div>
  );
}
