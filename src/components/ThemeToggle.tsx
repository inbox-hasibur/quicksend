"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)]" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="h-8 w-8 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-neutral-200/60 dark:hover:bg-neutral-750 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-all cursor-pointer shadow-2xs"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-neutral-700 dark:text-neutral-300 transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}
