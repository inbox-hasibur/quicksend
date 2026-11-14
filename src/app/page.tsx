import { Suspense } from "react";
import { QrCode, Lock, Zap, ShieldCheck } from "lucide-react";
import { ModeSelector } from "@/components/ModeSelector";
import { AppHeader } from "@/components/AppHeader";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-3.5 sm:p-6 md:p-10 text-[var(--text)] overflow-x-hidden">
      {/* Top Header with Brand Logo, Date, History & Status */}
      <AppHeader />

      {/* Main Hub Content & Adaptive Workspace */}
      <div className="w-full max-w-5xl flex flex-col items-center flex-1 justify-center py-2">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-5 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-neutral-100/90 dark:bg-neutral-800/80 text-[var(--text-muted)] mb-3 border border-[var(--border-soft)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Zero Accounts • Direct P2P • No Cloud Retention</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-2 leading-tight text-[var(--text)]">
            Share any files or text{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 bg-clip-text text-transparent">
              in seconds.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Zero-login peer-to-peer sharing between your phone, PC, and lab devices.
          </p>
        </div>

        {/* 4 Transfer Modes Selector (Desktop Rail + Focused Workspace | Mobile Tiles) */}
        <Suspense
          fallback={
            <div className="h-40 flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">
              Loading QuickSend workspace...
            </div>
          }
        >
          <ModeSelector />
        </Suspense>
      </div>

      {/* Trust & Guarantee Footer */}
      <footer className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--text-muted)] pt-8 mt-10 border-t border-[var(--border-soft)]">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <Lock className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted DTLS DataChannel</span>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <QrCode className="h-3.5 w-3.5 text-[var(--accent)]" />
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
