"use client";

import { Download, Copy, Check, RotateCcw } from "lucide-react";
import type { ReassembledPayload } from "@/lib/opticalDataStream";
import { formatBytes } from "@/lib/chunker";

export interface ReceiverCompleteViewProps {
  payload: ReassembledPayload;
  copied: boolean;
  onCopyText: () => void;
  onDownload: () => void;
  onScanAnother: () => void;
}

export function ReceiverCompleteView({
  payload,
  copied,
  onCopyText,
  onDownload,
  onScanAnother,
}: ReceiverCompleteViewProps) {
  return (
    <div className="p-6 sm:p-8 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl text-center space-y-5">
      <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-xs">
        <Check className="w-7 h-7" />
      </div>

      <div>
        <h4 className="font-bold text-base text-[var(--text)]">Transfer Complete!</h4>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Air-gapped optical payload was assembled with 100% data integrity.
        </p>
      </div>

      <div className="p-4 bg-[var(--surface)] border border-[var(--border-hairline)] rounded-xl max-w-sm mx-auto text-left">
        <div className="font-medium text-xs text-[var(--text)] truncate">
          {payload.fileName}
        </div>
        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
          {formatBytes(payload.fileSize)} • {payload.mimeType}
        </div>

        {payload.text && (
          <div className="mt-3 p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-hairline)] font-mono text-xs max-h-32 overflow-y-auto whitespace-pre-wrap break-all text-[var(--text)]">
            {payload.text}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-sm mx-auto w-full">
        {payload.text ? (
          <button
            type="button"
            onClick={onCopyText}
            className="w-full py-3 px-5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-opacity flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied to Clipboard!" : "Copy Text"}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onDownload}
            className="w-full py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-opacity flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Save / Download File</span>
          </button>
        )}

        <button
          type="button"
          onClick={onScanAnother}
          className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] font-semibold text-xs hover:bg-[var(--surface-subtle)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Scan Another</span>
        </button>
      </div>
    </div>
  );
}
