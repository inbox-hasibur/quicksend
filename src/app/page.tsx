import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-white dark:bg-[#151822] text-[var(--text-muted)] mb-3 border border-[var(--border-hairline)] shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-800 dark:text-neutral-200" />
            <span>Zero Accounts • Direct P2P • No Cloud Retention</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2 leading-tight text-[var(--text)]">
            Instant Peer-to-Peer Transfer
          </h1>

          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Fast, zero-login file &amp; text beam between your phone, PC, and lab devices.
          </p>
        </div>

        {/* 4 Transfer Modes Selector (Clean Options Grid / Focused Workspace) */}
        <Suspense
          fallback={
            <div className="h-40 flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">
              Loading QuickSend channels...
            </div>
          }
        >
          <ModeSelector />
        </Suspense>
      </div>

      {/* Redesigned Minimal Clean Footer */}
      <footer className="w-full max-w-4xl pt-8 pb-4 mt-8 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)] font-mono">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            DTLS Encrypted
          </span>
          <span>•</span>
          <span>Peer-to-Peer</span>
          <span>•</span>
          <span>Zero Server Storage</span>
        </div>

        <div className="text-[11px] text-[var(--text-muted)]">
          QuickSend • Browser Beam
        </div>
      </footer>
    </main>
  );
}
