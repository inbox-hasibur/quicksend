"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Wifi, WifiOff } from "lucide-react";

export function NetworkStatusBadge() {
  const isOnline = useNetworkStatus();

  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur-md transition-colors ${
        isOnline
          ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
          : "border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
      </span>
      <span className="font-medium">
        {isOnline ? "Online (All Modes)" : "Offline (PWA Mode)"}
      </span>
      {isOnline ? (
        <Wifi className="h-3 w-3 opacity-70" />
      ) : (
        <WifiOff className="h-3 w-3 opacity-70" />
      )}
    </div>
  );
}
