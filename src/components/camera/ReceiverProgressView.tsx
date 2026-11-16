"use client";

import { Copy, Check } from "lucide-react";
import { formatBytes } from "@/lib/chunker";
import { encodeRecoveryCode } from "@/lib/opticalRecovery";

export interface ReceiverProgressViewProps {
  scanProgress: {
    fileName: string;
    fileSize: number;
    totalChunks: number;
    receivedCount: number;
    percentage: number;
    missingIndices: number[];
  };
  sessionHash: string | null;
  showRecoveryCode: boolean;
  recoveryCodeCopied: boolean;
  onToggleRecoveryCode: () => void;
  onCopyRecoveryCode: (code: string) => void;
}

export function ReceiverProgressView({
  scanProgress,
  sessionHash,
  showRecoveryCode,
  recoveryCodeCopied,
  onToggleRecoveryCode,
  onCopyRecoveryCode,
}: ReceiverProgressViewProps) {
  const missing = scanProgress.missingIndices;

  return (
    <div className="p-4 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="font-bold text-[var(--text)]">{scanProgress.fileName}</span>
          <span className="text-[var(--text-muted)] ml-2">
            ({formatBytes(scanProgress.fileSize)})
          </span>
        </div>
        <span className="font-mono tabular-nums text-[var(--accent)] font-semibold">
          Received {scanProgress.receivedCount} of {scanProgress.totalChunks} frames ({scanProgress.percentage}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-150"
          style={{ width: `${scanProgress.percentage}%` }}
        />
      </div>

      {/* Missing frames recovery code */}
      {scanProgress.totalChunks > 0 && missing.length > 0 && (
        <div className="pt-2 flex flex-col items-center">
          <button
            type="button"
            onClick={onToggleRecoveryCode}
            className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
          >
            {showRecoveryCode ? "Hide missing frames code" : "Missing frames code"}
          </button>

          {showRecoveryCode && (
            <div className="mt-2.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] w-full text-left space-y-2">
              {(() => {
                if (!sessionHash) {
                  return (
                    <p className="text-xs text-[var(--text-muted)]">
                      Waiting for stream session hash...
                    </p>
                  );
                }
                const code = encodeRecoveryCode(sessionHash, missing);
                if (!code) {
                  return (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Too many missing. Keep scanning.
                    </p>
                  );
                }
                return (
                  <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span>Missing {missing.length} frames</span>
                      <button
                        type="button"
                        onClick={() => onCopyRecoveryCode(code)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
                      >
                        {recoveryCodeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {recoveryCodeCopied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="text-base text-[var(--text)] font-sans leading-relaxed break-words select-all">
                      {code}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
