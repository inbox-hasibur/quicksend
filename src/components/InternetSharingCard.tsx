"use client";

import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Copy,
  Check,
  RotateCcw,
  Send,
  ArrowDownToLine,
  AlertCircle,
  X,
  CheckCircle2,
  Link as LinkIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { QRScannerModal } from "@/components/QRScannerModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useRelayTransfer } from "@/hooks/useRelayTransfer";
import { formatBytes } from "@/lib/chunker";
import { getPayloadBytes } from "@/lib/transferEstimate";
import { RELAY_MAX_FILE_BYTES } from "@/lib/relayLimits";

export interface InternetSharingCardProps {
  initialRoomCode?: string;
  initialOtp?: string;
}

export function InternetSharingCard({ initialRoomCode, initialOtp }: InternetSharingCardProps) {
  const initialReceive = Boolean(initialOtp || initialRoomCode);
  const [role, setRole] = useState<"send" | "receive">(initialReceive ? "receive" : "send");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [inputOtp, setInputOtp] = useState(() => {
    const raw = initialOtp || initialRoomCode || "";
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    return digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
  });
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<{ files: string[]; text?: string } | null>(
    null
  );
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCompletedText, setCopiedCompletedText] = useState(false);
  const hasAutoReceivedRef = useRef(false);

  const {
    relayStatus,
    relayState,
    progress,
    uploadedBytes,
    downloadedBytes,
    totalBytes,
    chunksDone,
    chunksTotal,
    relayCode,
    otpCode,
    qrUrl,
    error: relayError,
    isDownloading,
    startRelaySend,
    receiveByOtp,
    cancelRelay,
  } = useRelayTransfer();

  const maxFileBytes = relayStatus?.maxFileBytes || RELAY_MAX_FILE_BYTES;
  const hasOversizedFile = selectedPayload.files.some((f) => f.size > maxFileBytes);
  const canSend =
    !hasOversizedFile && (selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0);
  const payloadTotalBytes = getPayloadBytes(selectedPayload.files, selectedPayload.text);

  // Receiver auto-submit handler
  const handleReceive = async (codeToUse?: string) => {
    const raw = codeToUse || inputOtp;
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 6) {
      setReceiveError("Please enter a valid 6-digit OTP.");
      return;
    }
    setReceiveError(null);
    try {
      await receiveByOtp(digits);
      setCompletedResult({ files: ["Downloaded transfer"] });
    } catch (err) {
      setReceiveError(
        err instanceof Error ? err.message : "Invalid or expired OTP. Please check the 6-digit code."
      );
    }
  };

  // Auto-connect receiver once if initialOtp was passed from URL
  useEffect(() => {
    const candidate = initialOtp || initialRoomCode;
    if (candidate && !hasAutoReceivedRef.current) {
      const digits = candidate.replace(/\D/g, "").slice(0, 6);
      if (digits.length === 6) {
        hasAutoReceivedRef.current = true;
        void (async () => {
          try {
            await receiveByOtp(digits);
            setCompletedResult({ files: ["Downloaded transfer"] });
          } catch (err) {
            setReceiveError(
              err instanceof Error ? err.message : "Invalid or expired OTP. Please check the 6-digit code."
            );
          }
        })();
      }
    }
  }, [initialOtp, initialRoomCode, receiveByOtp]);

  const handleSend = async () => {
    if (!canSend) return;
    try {
      await startRelaySend(selectedPayload.files, selectedPayload.text);
    } catch {
      // Error handled by hook
    }
  };

  const handleReset = () => {
    cancelRelay();
    setSelectedPayload({ files: [], text: "" });
    setReceiveError(null);
    setCompletedResult(null);
  };

  const handleScannerSuccess = (scanned: string) => {
    setIsScannerOpen(false);
    setReceiveError(null);
    const match = scanned.match(/#otp=([0-9\s-]+)/i) || scanned.match(/[?&]otp=([0-9\s-]+)/i);
    const rawDigits = match ? match[1].replace(/\D/g, "") : scanned.replace(/\D/g, "");
    if (rawDigits.length === 6) {
      setInputOtp(`${rawDigits.slice(0, 3)} ${rawDigits.slice(3)}`);
      handleReceive(rawDigits);
    } else {
      setReceiveError("Invalid QR Code: No 6-digit OTP found.");
    }
  };

  const activeOtp = otpCode || relayCode || "";
  const cleanDigits = activeOtp.replace(/\D/g, "");
  const formattedOtpDisplay =
    cleanDigits.length === 6 ? `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3)}` : activeOtp;

  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://quicksend.vercel.app";
  const directLink = qrUrl || `${origin}/#otp=${cleanDigits}`;

  const handleCopyOtp = async () => {
    try {
      await navigator.clipboard.writeText(formattedOtpDisplay);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  const handleCopyCompletedText = async () => {
    if (completedResult?.text) {
      try {
        await navigator.clipboard.writeText(completedResult.text);
        setCopiedCompletedText(true);
        setTimeout(() => setCopiedCompletedText(false), 2000);
      } catch {
        // Ignore clipboard fallback
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP ROLE SWITCHER */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">
            {role === "send" ? "Send Files or Text" : "Receive Files"}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {role === "send"
              ? "Upload and share with a simple 6-digit OTP or QR code"
              : "Enter 6-digit OTP or scan sender's QR code"}
          </p>
        </div>

        <SegmentedControl
          ariaLabel="Transfer Role"
          value={role}
          onChange={(val) => {
            setRole(val as "send" | "receive");
            setReceiveError(null);
          }}
          options={[
            { value: "send", label: "Send" },
            { value: "receive", label: "Receive" },
          ]}
        />
      </div>

      {/* 2. TAB 1: SEND VIEW */}
      {role === "send" && (
        <div className="space-y-5">
          {/* STEP 1: Select files/text (before clicking Send) */}
          {relayState === "idle" && (
            <div className="space-y-4">
              {relayError && (
                <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{relayError}</span>
                </div>
              )}

              <Dropzone onSelectionChange={setSelectedPayload} />

              <EstimateBadge channel="internet" totalBytes={payloadTotalBytes} />

              {hasOversizedFile && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Files over 750 MB? Use Same Wi-Fi, Hotspot, or Cable.
                </p>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-sm shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </button>
            </div>
          )}

          {/* STEP 2: Uploading chunks progress */}
          {(relayState === "encrypting" || relayState === "uploading" || relayState === "registering") && (
            <div className="p-6 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4 text-center animate-in fade-in">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[var(--text)]">Sending Transfer</h4>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  {relayState === "encrypting"
                    ? "Encrypting with client key..."
                    : relayState === "registering"
                    ? "Finalizing transfer..."
                    : `Preparing & sending chunk ${Math.min(chunksDone + 1, chunksTotal || 1)} of ${chunksTotal || 1} • ${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)}`}
                </p>
              </div>

              <div className="w-full bg-[var(--surface)] h-2.5 rounded-full overflow-hidden border border-[var(--border-hairline)]">
                <div
                  className="bg-[var(--accent)] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">
                {progress}%
              </span>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Ready — Centered QR code + ONE 6-digit OTP box */}
          {relayState === "ready" && cleanDigits.length === 6 && (
            <div className="p-6 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col items-center space-y-5 text-center animate-in fade-in">
              {/* Centered QR Code */}
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-[var(--border-hairline)]">
                <QRCodeSVG
                  value={directLink}
                  size={180}
                  level="M"
                  includeMargin={false}
                  className="rounded-lg"
                />
              </div>

              {/* Single Clean 6-Digit Numeric OTP Box */}
              <div className="space-y-1.5 w-full max-w-xs">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                  6-Digit OTP
                </span>
                <div className="flex items-center justify-center gap-3 py-2.5 px-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xs">
                  <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-[var(--accent)] tabular-nums">
                    {formattedOtpDisplay}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOtp}
                    className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
                    title="Copy OTP"
                  >
                    {copiedOtp ? (
                      <Check className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] font-semibold text-xs text-[var(--text)] transition-all shadow-2xs cursor-pointer"
                >
                  {copiedLink ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <LinkIcon className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedLink ? "Link Copied" : "Copy Direct Link"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)] font-medium text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Send another</span>
                </button>
              </div>
            </div>
          )}

          {/* Fallback error if send failed */}
          {relayState === "error" && (
            <div className="p-6 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4 text-center animate-in fade-in">
              <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{relayError || "Upload failed"}</span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--bg)] font-semibold text-xs transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. TAB 2: RECEIVE VIEW */}
      {role === "receive" && (
        <div className="space-y-5 max-w-md mx-auto">
          {/* DOWNLOADING STATE */}
          {isDownloading ? (
            <div className="p-6 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4 text-center animate-in fade-in">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[var(--text)]">Downloading Transfer</h4>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  Downloading {formatBytes(downloadedBytes)} of {formatBytes(totalBytes)}
                </p>
              </div>

              <div className="w-full bg-[var(--surface)] h-2.5 rounded-full overflow-hidden border border-[var(--border-hairline)]">
                <div
                  className="bg-[var(--accent)] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">
                {progress}%
              </span>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : completedResult ? (
            /* COMPLETED STATE */
            <div className="p-6 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4 text-center animate-in fade-in">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-base text-[var(--text)]">Transfer Complete!</h4>
                <p className="text-xs text-[var(--text-muted)]">
                  {completedResult.files.length > 0
                    ? "Your files were received and saved to downloads."
                    : "Text snippet received successfully."}
                </p>
              </div>

              {completedResult.text && (
                <div className="space-y-2 text-left">
                  <div className="p-3 max-h-32 overflow-y-auto rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] font-mono text-xs whitespace-pre-wrap break-all text-[var(--text)]">
                    {completedResult.text}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCompletedText}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedCompletedText ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedCompletedText ? "Copied Text" : "Copy to Clipboard"}</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setCompletedResult(null);
                  setInputOtp("");
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--surface)] text-[var(--text)] font-semibold text-xs transition-colors cursor-pointer"
              >
                Receive another
              </button>
            </div>
          ) : (
            /* DEFAULT RECEIVE INPUT & SCAN SCREEN */
            <div className="space-y-5">
              {/* Inline dismissible error banner */}
              {(receiveError || relayError) && (
                <div className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{receiveError || relayError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiveError(null)}
                    className="p-1 rounded-md hover:bg-red-200/50 dark:hover:bg-red-800/50 text-red-600 dark:text-red-300 cursor-pointer"
                    aria-label="Dismiss error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Prominent Scan QR Code camera button */}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                <span>Scan QR Code</span>
              </button>

              {/* Clean divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[var(--border-hairline)]" />
                <span className="flex-shrink mx-4 text-[var(--text-muted)] text-xs font-mono uppercase tracking-wider">
                  or enter 6-digit OTP
                </span>
                <div className="flex-grow border-t border-[var(--border-hairline)]" />
              </div>

              {/* 6-Digit OTP Input Card */}
              <div className="p-6 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3.5 text-center">
                <div className="space-y-1">
                  <label htmlFor="otp-input" className="font-bold text-sm text-[var(--text)] block">
                    Enter 6-Digit Code
                  </label>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Type the code shown on the sender device
                  </p>
                </div>

                <div className="space-y-2.5">
                  <input
                    id="otp-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={7}
                    value={inputOtp}
                    onChange={(e) => {
                      setReceiveError(null);
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                      const formatted =
                        digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
                      setInputOtp(formatted);
                      if (digits.length === 6) {
                        handleReceive(digits);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const digits = inputOtp.replace(/\D/g, "");
                        if (digits.length === 6) {
                          handleReceive(digits);
                        }
                      }
                    }}
                    placeholder="482 915"
                    className="w-full py-3.5 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] text-center font-mono font-bold text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:font-normal placeholder:tracking-normal placeholder:text-sm placeholder:text-[var(--text-muted)]"
                  />

                  <button
                    type="button"
                    onClick={() => handleReceive()}
                    disabled={inputOtp.replace(/\D/g, "").length !== 6 || isDownloading}
                    className="w-full py-3 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    <span>Receive</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR Scanner Camera Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScannerSuccess}
      />
    </div>
  );
}
