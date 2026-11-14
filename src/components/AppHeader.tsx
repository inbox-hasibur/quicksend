"use client";

import { useState } from "react";
import { Clock, Zap } from "lucide-react";
import { NetworkStatusBadge } from "@/components/NetworkStatusBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TransferHistoryModal } from "@/components/TransferHistoryModal";
import { useTransferHistory } from "@/hooks/useTransferHistory";

export function AppHeader() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { history, clearHistory } = useTransferHistory();

  return (
    <>
      <header className="z-10 w-full max-w-4xl flex items-center justify-between px-4 py-3 rounded-2xl bg-white dark:bg-[#151822] border border-[var(--border-hairline)] shadow-2xs mb-6 sm:mb-8 transition-colors">
        {/* Brand identity: Minimalist & Crisp */}
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-2xs flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 fill-current" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="font-extrabold text-base sm:text-lg text-[var(--text)] tracking-tight leading-tight">
              QuickSend
            </h1>
            <span className="hidden sm:inline text-[11px] text-[var(--text-muted)] font-mono">
              p2p beam
            </span>
          </div>
        </div>

        {/* Right action bar: Status, History, Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <NetworkStatusBadge />

          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text)] hover:bg-neutral-200/60 dark:hover:bg-neutral-750 transition-all cursor-pointer"
            title="Session Transfer History"
          >
            <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="hidden sm:inline">History</span>
            {history.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] font-bold tabular-nums">
                {history.length}
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-[var(--border-hairline)] mx-0.5 hidden sm:block" />

          <ThemeToggle />
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
