"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Globe,
  Wifi,
  Smartphone,
  Bluetooth,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import type { TransferMode, ModeStatus } from "@/types/mode";
import { useBrowserCapabilities } from "@/hooks/useNetworkStatus";
import { getAllModesStatus } from "@/lib/modeAvailability";
import { InternetSharingCard } from "@/components/InternetSharingCard";
import { SameNetworkCard } from "@/components/SameNetworkCard";
import { HotspotAssistantCard } from "@/components/HotspotAssistantCard";

export function ModeSelector() {
  const searchParams = useSearchParams();
  const initialRoomCode = searchParams.get("room") || undefined;

  const capabilities = useBrowserCapabilities();
  const modes: ModeStatus[] = getAllModesStatus(capabilities);
  const [selectedMode, setSelectedMode] = useState<TransferMode | null>(
    initialRoomCode ? "internet" : null
  );

  const getModeIcon = (mode: TransferMode) => {
    switch (mode) {
      case "internet":
        return <Globe className="h-6 w-6 text-indigo-500" />;
      case "same-network":
        return <Wifi className="h-6 w-6 text-emerald-500" />;
      case "hotspot":
        return <Smartphone className="h-6 w-6 text-amber-500" />;
      case "bluetooth":
        return <Bluetooth className="h-6 w-6 text-blue-500" />;
    }
  };

  const activeModeDetails = modes.find((m) => m.mode === selectedMode);

  return (
    <div className="w-full max-w-5xl space-y-8">
      {/* 4 Transfer Mode Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {modes.map((item) => {
          const isSelected = selectedMode === item.mode;
          const isDisabled = !item.isAvailable;

          return (
            <div
              key={item.mode}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              onClick={() => {
                if (!isDisabled) {
                  setSelectedMode(item.mode);
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                  setSelectedMode(item.mode);
                }
              }}
              className={`relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border transition-all text-left ${
                isDisabled
                  ? "opacity-55 cursor-not-allowed bg-neutral-100/70 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800"
                  : isSelected
                  ? "ring-2 ring-indigo-500 bg-white dark:bg-neutral-850 shadow-md border-indigo-300 dark:border-indigo-700 cursor-pointer"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 hover:shadow-sm cursor-pointer"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                      {getModeIcon(item.mode)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-base sm:text-lg text-neutral-900 dark:text-neutral-100">
                        {item.name}
                      </h3>
                      <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                        {item.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Mode Badge */}
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      isDisabled
                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>

                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 leading-relaxed">
                  {item.description}
                </p>

                {/* Sub-options preview tags */}
                {item.mode === "internet" && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 text-xs">
                    <span className="text-neutral-400">Format:</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px]">
                      Unique Code (PIN)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px]">
                      QR Code URL
                    </span>
                    <span className="text-neutral-400 ml-1">Flow:</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium">
                      Send | Receive
                    </span>
                  </div>
                )}

                {item.mode === "same-network" && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 text-xs">
                    <span className="text-neutral-400">Protocol:</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px]">
                      Host ICE Prioritized
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                      Camera QR Optical Fallback
                    </span>
                  </div>
                )}

                {item.mode === "hotspot" && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 text-xs">
                    <span className="text-neutral-400">Assistant:</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px]">
                      WIFI:T:WPA QR
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-medium">
                      PWA Offline Handshake
                    </span>
                  </div>
                )}

                {item.mode === "bluetooth" && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 text-xs">
                    <span className="text-neutral-400">Nearby:</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px]">
                      Quick Share / AirDrop
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
                      Web-BLE GATT Client
                    </span>
                  </div>
                )}

                {/* Disabled reason notice */}
                {isDisabled && item.disabledReason && (
                  <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>{item.disabledReason}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-500">
                  {isDisabled ? "Mode Disabled" : isSelected ? "Active Mode" : "Click to select"}
                </span>
                {!isDisabled && (
                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                    Configure <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Mode Execution Panel */}
      {selectedMode && activeModeDetails && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-neutral-900 p-6 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                {getModeIcon(selectedMode)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                    {activeModeDetails.name}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    Ready to Configure
                  </span>
                </div>
                <p className="text-xs text-neutral-500">{activeModeDetails.description}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedMode(null)}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode specific configuration component */}
          {selectedMode === "internet" && (
            <InternetSharingCard initialRoomCode={initialRoomCode} />
          )}

          {selectedMode === "same-network" && <SameNetworkCard />}

          {selectedMode === "hotspot" && <HotspotAssistantCard />}

          {selectedMode === "bluetooth" && (
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400">
                <Sparkles className="h-4 w-4" />
                <span>Proximity &amp; Quick Share</span>
              </div>
              <p className="text-xs text-neutral-500">
                Integrates the Web Share API with file attachments (triggering Quick Share, AirDrop, or Bluetooth File Transfer) alongside a Web-BLE GATT client for peripheral devices.
              </p>
              <div className="pt-2 flex gap-2">
                <button className="py-2 px-4 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                  Trigger Native Share
                </button>
                <button className="py-2 px-4 text-xs font-semibold rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  Scan BLE Hardware Peripherals
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
