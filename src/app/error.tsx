"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log uncaught error to console
    console.error("Application boundary caught error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shadow-xs">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h2 className="text-base font-bold text-[var(--text)]">This page could not load</h2>
        <p className="text-xs text-[var(--text-muted)] break-words leading-relaxed">
          {error?.message || "An unexpected error occurred while rendering this page."}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-xs transition-opacity cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reload
        </button>
      </div>
    </div>
  );
}
