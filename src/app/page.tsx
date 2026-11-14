import { Suspense } from "react";
import { ModeSelector } from "@/components/ModeSelector";
import { AppHeader } from "@/components/AppHeader";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-3.5 sm:p-6 md:p-8 text-[var(--text)] overflow-x-hidden">
      {/* Redesigned Minimal Clean Navbar */}
      <AppHeader />

      {/* Main Hub Content & Adaptive Workspace */}
      <div className="w-full max-w-4xl flex flex-col items-center flex-1 justify-center py-2 space-y-6">
        {/* Minimal Hero Section */}
        <div className="text-center max-w-xl">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2 leading-tight text-[var(--text)]">
            A universal quick file transfer webapp.
          </h1>

          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Fast, simple file &amp; text sharing between your phone, PC, and any device.
          </p>
        </div>

        {/* 5 Transfer Modes Selector (Clean Options Grid / Focused Workspace) */}
        <Suspense
          fallback={
            <div className="h-40 flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">
              Loading channels...
            </div>
          }
        >
          <ModeSelector />
        </Suspense>
      </div>

      {/* Redesigned Minimal Clean Footer */}
      <footer className="w-full max-w-4xl pt-6 sm:pt-8 pb-4 mt-6 sm:mt-8 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Direct Transfer
          </span>
          <span>•</span>
          <span>No Server Storage</span>
          <span>•</span>
          <span>Private</span>
        </div>

        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
          <span>Developed by</span>
          <span className="font-bold text-[var(--text)] tracking-tight">IncodeBD</span>
        </div>
      </footer>
    </main>
  );
}
