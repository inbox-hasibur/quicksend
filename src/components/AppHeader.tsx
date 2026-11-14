"use client";

import { useState, useSyncExternalStore } from "react";
import { Clock, Zap } from "lucide-react";
import { NetworkStatusBadge } from "@/components/NetworkStatusBadge";
import { TransferHistoryModal } from "@/components/TransferHistoryModal";
import { useTransferHistory } from "@/hooks/useTransferHistory";

const emptySubscribe = () => () => {};

function getClientDateSnapshot(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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
      <header className="z-10 w-full max-w-5xl flex items-center justify-between p-3.5 sm:p-4 glass-card mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[var(--accent)] text-white shadow-sm flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg sm:text-xl text-[var(--text)] tracking-tight leading-tight">
              QuickSend
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">
              Zero-login direct transfer {todayDate ? `• ${todayDate}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 pill bg-white dark:bg-neutral-800 border border-[var(--border-soft)] text-xs font-semibold text-[var(--text)] hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-all shadow-2xs cursor-pointer"
            title="Session Transfer History"
          >
            <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="hidden sm:inline">History</span>
            {history.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold tabular-nums">
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
