import { Suspense } from "react";
import { QrCode, Lock, Zap, ShieldCheck } from "lucide-react";
import { ModeSelector } from "@/components/ModeSelector";
import { AppHeader } from "@/components/AppHeader";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-3.5 sm:p-6 md:p-8 text-[var(--text)] overflow-x-hidden">
      {/* Top Header */}
      <AppHeader />

      {/* Main Hub Content & Adaptive Workspace */}
      <div className="w-full max-w-4xl flex flex-col items-center flex-1 justify-center py-2 space-y-6">
        {/* Hero Section */}
        <div className="text-center max-w-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-white dark:bg-neutral-800 text-[var(--text-muted)] mb-3 border border-[var(--border-hairline)] shadow-2xs">
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

      {/* Trust & Guarantee Footer */}
      <footer className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--text-muted)] pt-8 mt-10 border-t border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <Lock className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted DTLS DataChannel</span>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <QrCode className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" />
          <span>Camera QR &amp; PIN Handshake</span>
        </div>
        <div className="flex items-center gap-2 justify-center sm:justify-end">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>Offline Cached PWA</span>
        </div>
      </footer>
    </main>
  );
}
