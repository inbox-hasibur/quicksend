"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Download, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function AppHeader() {
  const router = useRouter();
  const { isInstalled, isIos, promptInstall, showManualGuide, setShowManualGuide } =
    usePwaInstall();

  const handleGoHome = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("quicksend:go-home"));
    }
    router.replace("/");
  };

  return (
    <header className="z-10 w-full max-w-4xl flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xs mb-5 sm:mb-8 transition-colors">
      {/* Brand identity: Clickable Home link */}
      <Link
        href="/"
        onClick={handleGoHome}
        className="flex items-center gap-2 sm:gap-2.5 group hover:opacity-90 transition-opacity cursor-pointer select-none"
        title="QuickSend Home"
      >
        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-[var(--accent)] text-[var(--bg)] shadow-2xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
        </div>
        <div className="flex items-center">
          <span className="font-extrabold text-base sm:text-lg text-[var(--text)] tracking-tight leading-tight">
            QuickSend
          </span>
        </div>
      </Link>

      {/* Right action bar: Install App pill & Theme Toggle */}
      <div className="flex items-center gap-2">
        {!isInstalled && (
          <button
            type="button"
            onClick={promptInstall}
            aria-label="Install QuickSend app"
            title="Install QuickSend as an offline standalone app"
            className="h-8 px-2.5 sm:px-3 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] flex items-center gap-1.5 text-xs font-semibold text-[var(--text)] transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
          >
            <Download className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
            <span>Install App</span>
          </button>
        )}
        <ThemeToggle />
      </div>

      {/* Manual Installation Guide Modal (for iOS Safari or unsupported prompt browsers) */}
      {showManualGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-[var(--surface-subtle)] text-[var(--accent)]">
                  <Download className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-sm text-[var(--text)]">Install QuickSend</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowManualGuide(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIos ? (
              <div className="space-y-3 text-xs text-[var(--text-muted)]">
                <p className="text-[var(--text)] font-medium">To install on iPhone or iPad:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                    <span className="font-bold text-[var(--accent)] shrink-0">1.</span>
                    <span>
                      Tap the <strong className="text-[var(--text)]">Share button</strong> (square with arrow up) at the bottom of Safari.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                    <span className="font-bold text-[var(--accent)] shrink-0">2.</span>
                    <span>
                      Scroll down and select <strong className="text-[var(--text)]">Add to Home Screen</strong>.
                    </span>
                  </div>
                </div>
                <p className="text-[11px]">QuickSend will open fullscreen and work completely offline.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-[var(--text-muted)]">
                <p className="text-[var(--text)] font-medium">To install as a desktop or mobile app:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                    <span className="font-bold text-[var(--accent)] shrink-0">1.</span>
                    <span>
                      Look for the <strong className="text-[var(--text)]">Install icon (⊕)</strong> in your browser&apos;s address bar.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                    <span className="font-bold text-[var(--accent)] shrink-0">2.</span>
                    <span>
                      Or open the browser menu <strong className="text-[var(--text)]">(⋮)</strong> &rarr; <strong className="text-[var(--text)]">Install QuickSend</strong> (or &quot;Add to Home screen&quot; / &quot;Add to Dock&quot;).
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowManualGuide(false)}
              className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default AppHeader;
