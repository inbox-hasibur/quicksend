"use client";

import { useState } from "react";
import { X, Clock, ArrowUpRight, ArrowDownLeft, File, FileText, Trash2, Copy, Check } from "lucide-react";
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback if clipboard API is unavailable
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text)]">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text)]">
                Session History
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Ephemeral log • Cleared automatically on tab close
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {history.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-[var(--surface-subtle)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
              <File className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-sm text-[var(--text)]">
              No transfers yet
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">
              Items you send or receive in this session will appear here for quick reference and copying.
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center ${
                      item.direction === "sent"
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {item.direction === "sent" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--text)] truncate">
                      {item.itemType === "file" ? (
                        <FileTypeBadge fileName={item.name} />
                      ) : (
                        <FileText className="h-3 w-3 shrink-0 text-[var(--accent)]" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono mt-0.5 tabular-nums">
                      <span>{item.direction === "sent" ? "Sent" : "Received"}</span>
                      {item.size ? <span>• {formatBytes(item.size)}</span> : null}
                      <span>
                        • {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.textSnippet && (
                    <button
                      type="button"
                      onClick={() => handleCopy(item.id, item.textSnippet!)}
                      className="px-2.5 py-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[11px] font-medium text-[var(--text)] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy text snippet"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-[var(--text-muted)]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}

                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[var(--surface-muted)] text-[var(--text-muted)]">
                    {item.mode}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        {history.length > 0 && (
          <div className="pt-2 flex items-center justify-between border-t border-[var(--border-hairline)]">
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
              className="px-5 py-2 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
