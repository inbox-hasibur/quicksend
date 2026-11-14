"use client";

import { useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  ArrowDownToLine,
  Zap,
  ShieldCheck,
} from "lucide-react";
import type { TransferProgressState } from "@/types/transfer";
import { formatBytes, formatSpeed } from "@/lib/chunker";
import { FileTypeBadge } from "@/components/FileTypeBadge";

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

  // Modal is only visible when transfer is active or completed/rejected
  if (progress.status === "idle" || progress.status === "connecting") {
    return null;
  }

  const handleCopyText = async () => {
    if (progress.textContent) {
      await navigator.clipboard.writeText(progress.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTitle = () => {
    switch (progress.status) {
      case "waiting-acceptance":
        return "Incoming Transfer Beam";
      case "transferring":
        return progress.totalFiles && progress.totalFiles > 1
          ? `Beaming File ${progress.fileIndex || 1} of ${progress.totalFiles}...`
          : "Beaming In Progress...";
      case "completed":
        return progress.totalFiles && progress.totalFiles > 1
          ? `Batch Transfer Complete (${progress.totalFiles} Files)`
          : "Transfer Complete!";
      case "rejected":
        return "Transfer Declined";
      case "error":
        return "Transfer Error";
      default:
        return "QuickSend P2P";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-6 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[var(--accent)] flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
              {getTitle()}
            </h3>
          </div>
          {(progress.status === "completed" ||
            progress.status === "rejected" ||
            progress.status === "error") && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
        </div>

        {/* Content Details */}
        <div className="space-y-4">
          {/* File or Text info card */}
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-[var(--border-hairline)] dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/60">
            {progress.itemType === "file" ? (
              <FileTypeBadge fileName={progress.fileName} className="mt-0.5" />
            ) : (
              <FileText className="h-6 w-6 text-[var(--accent)] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-sm truncate text-neutral-900 dark:text-neutral-100">
                  {progress.itemType === "file"
                    ? progress.fileName || "File Payload"
                    : "Text / Link Snippet"}
                </p>
                {progress.isVerified && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                    <ShieldCheck className="h-3 w-3" />
                    Verified ✓
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-neutral-500 font-mono tabular-nums">
                  {progress.itemType === "file"
                    ? formatBytes(progress.fileSize || progress.totalBytes)
                    : `${progress.totalBytes} characters`}
                </p>

                {progress.totalFiles && progress.totalFiles > 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                    File {progress.fileIndex || 1} of {progress.totalFiles}
                  </span>
                )}
              </div>

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
                {progress.totalFiles && progress.totalFiles > 1
                  ? `A connected peer wants to beam a batch of ${progress.totalFiles} files directly to your device.`
                  : `A connected peer wants to beam this ${progress.itemType} directly to your device.`}
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onAccept}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  <span>
                    {progress.totalFiles && progress.totalFiles > 1
                      ? `Accept All ${progress.totalFiles} Files`
                      : "Accept & Download"}
                  </span>
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
                <div className="flex items-center justify-between text-xs font-mono text-neutral-500 tabular-nums">
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    {progress.progressPercentage}%
                  </span>
                  <span className="font-bold text-[var(--accent)]">
                    {formatSpeed(progress.speedBps)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-150 ease-out rounded-full"
                    style={{ width: `${progress.progressPercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 tabular-nums">
                  <span>{formatBytes(progress.bytesTransferred)}</span>
                  <span>{formatBytes(progress.totalBytes)}</span>
                </div>
              </div>

              {progress.totalFiles && progress.totalFiles > 1 && progress.totalBatchBytes && (
                <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-700 dark:text-indigo-300 font-mono flex items-center justify-between">
                  <span>Batch Progress:</span>
                  <span className="font-bold">
                    File {progress.fileIndex || 1} of {progress.totalFiles} ({formatBytes(progress.totalBatchBytes)})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 3. Completed view */}
          {progress.status === "completed" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <span>
                    {progress.totalFiles && progress.totalFiles > 1
                      ? `All ${progress.totalFiles} files successfully beamed and saved to your downloads!`
                      : progress.itemType === "file"
                        ? "File successfully beamed and saved to your downloads!"
                        : "Text snippet received successfully!"}
                  </span>
                  {progress.isVerified && (
                    <p className="mt-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      SHA-256 Bit-Perfect Integrity Verified ✓
                    </p>
                  )}
                </div>
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
