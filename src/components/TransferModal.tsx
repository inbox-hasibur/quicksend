"use client";

import { useState } from "react";
import {
  FileText,
  File,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  ArrowDownToLine,
  Zap,
} from "lucide-react";
import type { TransferProgressState } from "@/types/transfer";
import { formatBytes, formatSpeed } from "@/lib/chunker";

interface TransferModalProps {
  progress: TransferProgressState;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

export function TransferModal({
  progress,
  onAccept,
  onReject,
  onClose,
}: TransferModalProps) {
  const [copied, setCopied] = useState(false);

  if (progress.status === "idle") return null;

  const handleCopyText = async () => {
    if (progress.textContent) {
      try {
        await navigator.clipboard.writeText(progress.textContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                {progress.status === "waiting-acceptance"
                  ? "Incoming Transfer"
                  : progress.status === "transferring"
                  ? "Transferring Data..."
                  : progress.status === "completed"
                  ? "Transfer Complete!"
                  : progress.status === "rejected"
                  ? "Transfer Declined"
                  : "Transfer Status"}
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                {progress.itemType === "file" ? "Binary File Payload" : "Text Snippet Payload"}
              </p>
            </div>
          </div>

          {(progress.status === "completed" ||
            progress.status === "rejected" ||
            progress.status === "error") && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content Details */}
        <div className="space-y-4">
          {/* File or Text info card */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40">
            {progress.itemType === "file" ? (
              <File className="h-6 w-6 text-indigo-500 shrink-0 mt-0.5" />
            ) : (
              <FileText className="h-6 w-6 text-violet-500 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate text-neutral-900 dark:text-neutral-100">
                {progress.itemType === "file"
                  ? progress.fileName || "File Payload"
                  : "Text / Link Snippet"}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                {progress.itemType === "file"
                  ? formatBytes(progress.fileSize || progress.totalBytes)
                  : `${progress.totalBytes} characters`}
              </p>
              {progress.itemType === "text" && progress.textPreview && (
                <p className="text-xs text-neutral-400 mt-1 italic line-clamp-2">
                  &ldquo;{progress.textPreview}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* 1. Waiting for acceptance view */}
          {progress.status === "waiting-acceptance" && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-neutral-500 text-center">
                A connected peer wants to beam this {progress.itemType} directly to your device.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onAccept}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  <span>Accept &amp; Download</span>
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-semibold text-xs text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* 2. Transferring view */}
          {progress.status === "transferring" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                  <span>{progress.progressPercentage}%</span>
                  <span>{formatSpeed(progress.speedBps)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-150 ease-out rounded-full"
                    style={{ width: `${progress.progressPercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span>{formatBytes(progress.bytesTransferred)}</span>
                  <span>{formatBytes(progress.totalBytes)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. Completed view */}
          {progress.status === "completed" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <span>
                  {progress.itemType === "file"
                    ? "File successfully beamed and saved to your downloads!"
                    : "Text snippet received successfully!"}
                </span>
              </div>

              {progress.itemType === "text" && progress.textContent && (
                <div className="space-y-2">
                  <div className="p-3 max-h-36 overflow-y-auto rounded-xl bg-neutral-100 dark:bg-neutral-800 font-mono text-xs whitespace-pre-wrap break-all">
                    {progress.textContent}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy Text to Clipboard</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-xs transition-colors"
              >
                Close Transfer
              </button>
            </div>
          )}

          {/* 4. Error / Rejected views */}
          {(progress.status === "rejected" || progress.status === "error") && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
                <span>{progress.errorMessage || "Transfer was declined or interrupted."}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
