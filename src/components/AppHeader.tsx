"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  const router = useRouter();

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

      {/* Right action bar: Theme Toggle */}
      <div className="flex items-center">
        <ThemeToggle />
      </div>
    </header>
  );
}
