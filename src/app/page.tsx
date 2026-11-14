import { Suspense } from "react";
import { Zap, ShieldCheck, QrCode, Lock } from "lucide-react";
import { ModeSelector } from "@/components/ModeSelector";
import { NetworkStatusBadge } from "@/components/NetworkStatusBadge";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 sm:p-8 md:p-16 bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 text-neutral-900 dark:text-neutral-100">
      {/* Top Navigation & Status Header */}
      <header className="z-10 w-full max-w-5xl flex items-center justify-between font-mono text-sm mb-8 sm:mb-12">
        <div className="flex items-center gap-2.5 font-semibold tracking-tight text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
            <Zap className="h-4 w-4" />
          </div>
          <span className="font-sans font-bold">Share Anything</span>
        </div>

        <NetworkStatusBadge />
      </header>

      {/* Main Hub Content */}
      <div className="w-full max-w-5xl flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 mb-4">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Zero Accounts • Direct P2P • No Cloud Storage</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3">
            Instant peer-to-peer{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-600 bg-clip-text text-transparent">
              file &amp; text sharing
            </span>
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Beam files and text snippets between your phone, lab PC, and laptop in seconds. Select a transfer mode to begin:
          </p>
        </div>

        {/* 4 Transfer Modes Selector Component */}
        <Suspense fallback={<div className="h-48 flex items-center justify-center text-sm text-neutral-400">Loading transfer hub...</div>}>
          <ModeSelector />
        </Suspense>
      </div>

      {/* Trust & Guarantee Footer */}
      <footer className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-neutral-500 dark:text-neutral-400 pt-8 sm:pt-12 mt-12 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <Lock className="h-4 w-4 text-emerald-500" />
          <span>End-to-End Encrypted DTLS DataChannel</span>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <QrCode className="h-4 w-4 text-indigo-500" />
          <span>Cross-Device Camera QR Handshake</span>
        </div>
        <div className="flex items-center gap-2 justify-center sm:justify-end">
          <Zap className="h-4 w-4 text-amber-500" />
          <span>Offline PWA Shell Cache Enabled</span>
        </div>
      </footer>
    </main>
  );
}
