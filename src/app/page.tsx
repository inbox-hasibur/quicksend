import { Suspense } from "react";
import { QrCode, Lock, Zap, ShieldCheck } from "lucide-react";
import { ModeSelector } from "@/components/ModeSelector";
import { AppHeader } from "@/components/AppHeader";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 sm:p-8 md:p-12 text-neutral-900 dark:text-neutral-100">
      {/* Top Header with Logo, History & Status */}
      <AppHeader />

      {/* Main Hub Content */}
      <div className="w-full max-w-4xl flex flex-col items-center flex-1 justify-center">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-neutral-100/90 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 mb-3 border border-neutral-200/50 dark:border-neutral-700/50">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
            <span>Zero Accounts • Direct P2P • No Cloud Retention</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-2.5 leading-tight">
            Beam files &amp; text{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 bg-clip-text text-transparent">
              in seconds.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto">
            Zero-login peer-to-peer sharing between your phone, PC, and lab devices.
          </p>
        </div>

        {/* 4 Transfer Modes Selector (Compact tiles -> Dedicated Next Step) */}
        <Suspense fallback={<div className="h-40 flex items-center justify-center text-xs text-neutral-400 font-mono">Loading sharing hub...</div>}>
          <ModeSelector />
        </Suspense>
      </div>

      {/* Trust & Guarantee Footer */}
      <footer className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-neutral-400 dark:text-neutral-500 pt-8 mt-10 border-t border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <Lock className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted DTLS DataChannel</span>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <QrCode className="h-3.5 w-3.5 text-indigo-500" />
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
