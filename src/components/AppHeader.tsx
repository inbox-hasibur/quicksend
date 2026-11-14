"use client";

import { useState, useSyncExternalStore } from "react";
import { Clock } from "lucide-react";
import { NetworkStatusBadge } from "@/components/NetworkStatusBadge";
import { TransferHistoryModal } from "@/components/TransferHistoryModal";
import { useTransferHistory } from "@/hooks/useTransferHistory";

const emptySubscribe = () => () => {};

function getClientDateSnapshot(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getServerDateSnapshot(): string {
  return "";
}

export function AppHeader() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { history, clearHistory } = useTransferHistory();

  // Hydration-safe date snapshot
  const todayDate = useSyncExternalStore(
    emptySubscribe,
    getClientDateSnapshot,
    getServerDateSnapshot
  );

  return (
    <>
      <header className="z-10 w-full max-w-4xl flex items-center justify-between p-4 sm:p-5 glass-card mb-6 sm:mb-10">
        <div>
          <p className="text-xs text-[var(--text-muted)] font-medium h-4">
            {todayDate}
          </p>
          <h1 className="font-extrabold text-xl sm:text-2xl text-[var(--text)] tracking-tight">
            QuickSend
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 pill bg-white dark:bg-neutral-800 border border-[var(--border-soft)] text-xs font-semibold text-[var(--text)] hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-all shadow-2xs cursor-pointer"
            title="Session Transfer History"
          >
            <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="hidden sm:inline">History</span>
            {history.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold">
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
