"use client";

import { Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  return (
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

      {/* Right action bar: Theme Toggle */}
      <div className="flex items-center">
        <ThemeToggle />
      </div>
    </header>
  );
}
