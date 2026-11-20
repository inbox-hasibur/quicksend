"use client";

import { useState, useEffect } from "react";
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
  Lock,
  RefreshCw,
} from "lucide-react";
import type { TransferProgressState } from "@/types/transfer";
import { formatBytes, formatSpeed } from "@/lib/chunker";
import { formatRoomCode } from "@/lib/codeGenerator";
import { FileTypeBadge } from "@/components/FileTypeBadge";
import { estimateSeconds, formatDuration } from "@/lib/transferEstimate";

export interface TransferModalProps {
  progress: TransferProgressState;
  isOpen?: boolean;
  roomCode?: string;
  role?: "sender" | "receiver" | null;
  peerName?: string;
  diagnosticHint?: string;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
  onRelay?: () => void;
  isRelayAvailable?: boolean;
  relayPayload?: {
    salt: string;
    items?: { name: string; size: number }[];
    files?: { id: string; name: string; size: number; chunkCount: number; ivPrefix: string }[];
    text?: { cipherText: string; iv: string };
  } | null;
  onDownloadRelay?: (relayCode: string) => Promise<void> | void;
  isDownloadingRelay?: boolean;
  relayError?: string | null;
  relayDownloadedBytes?: number;
  relayTotalBytes?: number;
  relayProgress?: number;
}

export function TransferModal({
  progress,
  isOpen,
  roomCode,
  role,
  peerName,
  diagnosticHint,
  onAccept,
  onReject,
  onClose,
  onRelay,
  isRelayAvailable,
  relayPayload,
  onDownloadRelay,
  isDownloadingRelay,
  relayError,
  relayDownloadedBytes,
  relayTotalBytes,
  relayProgress,
}: TransferModalProps) {
  const [copied, setCopied] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [enteredRelayCode, setEnteredRelayCode] = useState(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash.startsWith("#otp=")) {
        return decodeURIComponent(window.location.hash.slice(5));
      }
      if (window.location.hash.startsWith("#rc=")) {
        return decodeURIComponent(window.location.hash.slice(4));
      }
    }
    return "";
  });
  const [localRelayError, setLocalRelayError] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      if (typeof window !== "undefined") {
        if (window.location.hash.startsWith("#otp=")) {
          setEnteredRelayCode(decodeURIComponent(window.location.hash.slice(5)));
        } else if (window.location.hash.startsWith("#rc=")) {
          setEnteredRelayCode(decodeURIComponent(window.location.hash.slice(4)));
        }
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Derive unique key for current status + payload + error so dismissal is 100% deterministic
  const currentTransferKey =
    progress.status === "idle"
      ? null
      : `${progress.status}_${progress.fileName || progress.totalBytes || "active"}_${progress.errorMessage || ""}`;

  const isDismissed = Boolean(currentTransferKey && dismissedKey === currentTransferKey);

  const handleDismiss = () => {
    if (currentTransferKey) {
      setDismissedKey(currentTransferKey);
    }
    onClose();
  };

  // Keyboard Escape listener to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Modal is only visible when transfer is active, completed/rejected, or relay payload detected, not dismissed, and isOpen is not false
  if (isOpen === false || (!currentTransferKey && !relayPayload) || isDismissed) {
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
      case "connecting":
        return "Connecting...";
      case "waiting-acceptance":
        return "Incoming Transfer";
      case "transferring":
        return progress.totalFiles && progress.totalFiles > 1
          ? `Sending File ${progress.fileIndex || 1} of ${progress.totalFiles}...`
          : "Transferring...";
      case "completed":
        return progress.totalFiles && progress.totalFiles > 1
          ? `Transfer Complete (${progress.totalFiles} Files)`
          : "Transfer Complete!";
      case "rejected":
        return "Transfer Declined";
      case "error":
        return "Transfer Error";
      default:
        return "QuickSend";
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="transfer-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          (progress.status === "error" || progress.status === "completed" || progress.status === "rejected")
        ) {
          handleDismiss();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-6 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-[var(--accent)] flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-base text-[var(--text)]">
              {getTitle()}
            </h3>
          </div>
          <button
            type="button"
            data-testid="transfer-modal-x-close"
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
            aria-label="Close transfer dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="space-y-4">
          {/* File or Text info card */}
          {(Boolean(progress.fileName) || (progress.totalBytes > 0 && progress.itemType === "file") || Boolean(progress.textContent)) ? (
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]">
              {progress.itemType === "file" ? (
                <FileTypeBadge fileName={progress.fileName} className="mt-0.5" />
              ) : (
                <FileText className="h-6 w-6 text-[var(--accent)] shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-bold text-sm truncate text-[var(--text)]">
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
                  <p className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
                    {progress.itemType === "file"
                      ? formatBytes(progress.fileSize || progress.totalBytes)
                      : `${progress.totalBytes} characters`}
                  </p>

                  {progress.totalFiles && progress.totalFiles > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                      File {progress.fileIndex || 1} of {progress.totalFiles}
                    </span>
                  )}
                </div>

                {progress.itemType === "text" && progress.textPreview && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 italic line-clamp-2">
                    &ldquo;{progress.textPreview}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-center space-y-1">
              <p className="font-bold text-sm text-[var(--text)]">
                {role === "sender"
                  ? `Connecting to ${peerName || "receiver"}...`
                  : roomCode
                  ? `Connecting to sender (${formatRoomCode(roomCode)})...`
                  : "Connecting to sender..."}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Establishing direct peer connection...
              </p>
            </div>
          )}

          {/* 0. Connecting view */}
          {progress.status === "connecting" && (
            <div className="space-y-3 pt-1">
              {(Boolean(progress.fileName) || (progress.totalBytes > 0 && progress.itemType === "file") || Boolean(progress.textContent)) && (
                <p className="text-xs text-center text-[var(--text-muted)]">
                  {role === "sender"
                    ? `Connecting to ${peerName || "receiver"}...`
                    : roomCode
                    ? `Connecting to sender (${formatRoomCode(roomCode)})...`
                    : "Connecting to sender..."}
                </p>
              )}
              <button
                type="button"
                data-testid="cancel-transfer-btn"
                onClick={handleDismiss}
                className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)] font-semibold text-xs text-[var(--text)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <X className="h-4 w-4" />
                <span>Cancel Transfer</span>
              </button>
            </div>
          )}

          {/* 1. Waiting for acceptance view */}
          {progress.status === "waiting-acceptance" && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-[var(--text-muted)] text-center">
                {progress.totalFiles && progress.totalFiles > 1
                  ? `A connected device wants to send a batch of ${progress.totalFiles} files to your device.`
                  : `A connected device wants to send this ${progress.itemType} to your device.`}
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onAccept}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
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
                  data-testid="cancel-transfer-btn"
                  onClick={onReject}
                  className="py-2.5 px-4 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)] font-semibold text-xs text-[var(--text)] transition-colors cursor-pointer"
                >
                  Cancel Transfer
                </button>
              </div>
            </div>
          )}

          {/* 2. Transferring view */}
          {progress.status === "transferring" && (() => {
            const remainingBytes = Math.max(0, progress.totalBytes - progress.bytesTransferred);
            const { seconds: remainingSeconds } = estimateSeconds("internet", remainingBytes, {
              measuredBytesPerSec: progress.speedBps,
            });
            const remainingDuration =
              progress.speedBps > 0 && remainingBytes > 0
                ? formatDuration(remainingSeconds)
                : null;

            return (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text)]">
                        {progress.progressPercentage}%
                      </span>
                      {remainingDuration && (
                        <span className="text-[11px] text-[var(--text-muted)] font-normal">
                          ETA: ~{remainingDuration}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-[var(--accent)]">
                      {formatSpeed(progress.speedBps)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-hairline)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-150 ease-out rounded-full"
                      style={{ width: `${progress.progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                    <span>{formatBytes(progress.bytesTransferred)}</span>
                    <span>{formatBytes(progress.totalBytes)}</span>
                  </div>
                </div>

                {progress.totalFiles && progress.totalFiles > 1 && progress.totalBatchBytes && (
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-300 font-mono flex items-center justify-between">
                    <span>Batch Progress:</span>
                    <span className="font-bold">
                      File {progress.fileIndex || 1} of {progress.totalFiles} ({formatBytes(progress.totalBatchBytes)})
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  data-testid="cancel-transfer-btn"
                  onClick={handleDismiss}
                  className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel Transfer</span>
                </button>
              </div>
            );
          })()}

          {/* 3. Completed view */}
          {progress.status === "completed" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <span>
                    {progress.totalFiles && progress.totalFiles > 1
                      ? `All ${progress.totalFiles} files received and saved to downloads!`
                      : progress.itemType === "file"
                        ? "File received and saved to downloads!"
                        : "Text snippet received successfully!"}
                  </span>
                  {progress.isVerified && (
                    <p className="mt-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Integrity Verified ✓
                    </p>
                  )}
                </div>
              </div>

              {progress.itemType === "file" && progress.downloadUrl && (
                <a
                  href={progress.downloadUrl}
                  download={progress.fileName || "download"}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer text-center"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  <span>
                    Save / Download File ({formatBytes(progress.fileSize || progress.totalBytes)})
                  </span>
                </a>
              )}

              {progress.itemType === "text" && progress.textContent && (
                <div className="space-y-2">
                  <div className="p-3 max-h-36 overflow-y-auto rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] font-mono text-xs whitespace-pre-wrap break-all text-[var(--text)]">
                    {progress.textContent}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
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
                onClick={handleDismiss}
                className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)] font-medium text-xs text-[var(--text)] transition-colors cursor-pointer"
              >
                Close Transfer
              </button>
            </div>
          )}

          {/* Encrypted Relay Download Card for Receiver */}
          {relayPayload && (
            <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text)]">
                  Encrypted Cloud Relay Ready
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-[var(--bg)]">
                  Encrypted
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {(relayPayload.files || relayPayload.items || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)]"
                  >
                    <span className="truncate max-w-[200px] font-medium text-[var(--text)]">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0 ml-2">
                      {formatBytes(item.size)}
                    </span>
                  </div>
                ))}
                {relayPayload.text && (
                  <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)]">
                    <span className="font-medium text-[var(--text)]">Encrypted text snippet</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">Text</span>
                  </div>
                )}
              </div>

              {/* Relay Code Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[var(--text-muted)] block">
                  Relay code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123-456 or XXXX-XXXX"
                  value={enteredRelayCode}
                  onChange={(e) => {
                    setEnteredRelayCode(e.target.value);
                    setLocalRelayError(null);
                  }}
                  className="w-full p-2.5 rounded-xl text-xs font-mono font-bold tracking-wider uppercase border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              {/* Error display */}
              {(localRelayError || relayError) && (
                <div className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                  {localRelayError || relayError}
                </div>
              )}

              {/* Downloading Progress Bar */}
              {isDownloadingRelay && (
                <div className="space-y-2 py-1 text-center animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-medium text-[var(--text)]">
                    <span>
                      {relayTotalBytes && relayTotalBytes > 0
                        ? `Downloading ${formatBytes(relayDownloadedBytes || 0)} of ${formatBytes(relayTotalBytes)}`
                        : "Downloading..."}
                    </span>
                    <span className="font-mono">{relayProgress || 0}%</span>
                  </div>
                  <div className="w-full bg-[var(--surface)] h-2 rounded-full overflow-hidden border border-[var(--border-hairline)]">
                    <div
                      className="bg-[var(--accent)] h-full transition-all duration-300"
                      style={{ width: `${relayProgress || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Download Button */}
              <button
                type="button"
                onClick={async () => {
                  if (!enteredRelayCode.trim()) return;
                  try {
                    setLocalRelayError(null);
                    await onDownloadRelay?.(enteredRelayCode.trim());
                  } catch (err) {
                    setLocalRelayError(err instanceof Error ? err.message : "Wrong relay code");
                  }
                }}
                disabled={isDownloadingRelay || !enteredRelayCode.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                {isDownloadingRelay ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Decrypting &amp; Downloading...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="h-4 w-4" />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 4. Error / Rejected views */}
          {(progress.status === "rejected" || progress.status === "error") && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
                <div className="space-y-1 min-w-0 flex-1">
                  <span>{progress.errorMessage || "Transfer was declined or interrupted."}</span>
                  {progress.status === "error" && diagnosticHint && (
                    <p className="font-mono text-[10px] opacity-75 break-all text-[var(--text-muted)]">
                      {diagnosticHint}
                    </p>
                  )}
                </div>
              </div>
              {onRelay && isRelayAvailable && (
                <button
                  type="button"
                  onClick={onRelay}
                  className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  <span>Send via encrypted cloud relay</span>
                </button>
              )}
              <button
                type="button"
                data-testid="transfer-modal-bottom-close"
                onClick={handleDismiss}
                className="w-full py-2 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer"
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
