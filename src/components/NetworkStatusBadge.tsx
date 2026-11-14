"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Wifi, WifiOff } from "lucide-react";

export function NetworkStatusBadge() {
  const isOnline = useNetworkStatus();

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-xs transition-all ${
        isOnline
          ? "bg-white/80 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-700 dark:text-neutral-200 backdrop-blur-md"
          : "bg-amber-50 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/60 text-amber-800 dark:text-amber-300"
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
      <span>{isOnline ? "Online" : "Offline (PWA)"}</span>
      {isOnline ? (
        <Wifi className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <WifiOff className="h-3 w-3 text-amber-600 dark:text-amber-400" />
      )}
    </div>
  );
}
