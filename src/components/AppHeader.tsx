"use client";

import { useState } from "react";
import { Zap, Clock } from "lucide-react";
import { NetworkStatusBadge } from "@/components/NetworkStatusBadge";
import { TransferHistoryModal } from "@/components/TransferHistoryModal";
import { useTransferHistory } from "@/hooks/useTransferHistory";

export function AppHeader() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { history, clearHistory } = useTransferHistory();

  return (
    <>
      <header className="z-10 w-full max-w-4xl flex items-center justify-between font-mono text-sm mb-6 sm:mb-10">
        <div className="flex items-center gap-2.5 font-bold tracking-tight text-base sm:text-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm">
            <Zap className="h-4 w-4 fill-current" />
          </div>
          <span className="font-sans font-extrabold tracking-tight">QuickSend</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-all shadow-2xs cursor-pointer"
            title="Session Transfer History"
          >
            <Clock className="h-3.5 w-3.5 text-neutral-400" />
            <span className="hidden sm:inline">History</span>
            {history.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                {history.length}
              </span>
            )}
          </button>

          <NetworkStatusBadge />
        </div>
      </header>

      <TransferHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onClear={clearHistory}
      />
    </>
  );
}
