"use client";

import { X, Clock, ArrowUpRight, ArrowDownLeft, File, FileText, Trash2 } from "lucide-react";
import type { TransferHistoryItem } from "@/types/transfer";
import { formatBytes } from "@/lib/chunker";
import { FileTypeBadge } from "@/components/FileTypeBadge";

interface TransferHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: TransferHistoryItem[];
  onClear: () => void;
}

export function TransferHistoryModal({
  isOpen,
  onClose,
  history,
  onClear,
}: TransferHistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#14151B] border border-neutral-200/80 dark:border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Session History
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                Ephemeral log • Cleared automatically on tab close
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {history.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
              <File className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-sm text-neutral-700 dark:text-neutral-300">
              No transfers yet
            </h4>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              Items you send or receive in this session will appear here for quick reference.
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center ${
                      item.direction === "sent"
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                        : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {item.direction === "sent" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {item.itemType === "file" ? (
                        <FileTypeBadge fileName={item.name} />
                      ) : (
                        <FileText className="h-3 w-3 shrink-0 text-[var(--accent)]" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono mt-0.5 tabular-nums">
                      <span>{item.direction === "sent" ? "Sent" : "Received"}</span>
                      {item.size ? <span>• {formatBytes(item.size)}</span> : null}
                      <span>• {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>

                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-neutral-200/70 dark:bg-neutral-700/60 text-neutral-700 dark:text-neutral-300">
                  {item.mode}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        {history.length > 0 && (
          <div className="pt-2 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors cursor-pointer font-medium"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear History</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
