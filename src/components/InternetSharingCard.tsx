"use client";

import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Send,
  Copy,
  Check,
  RefreshCw,
  ArrowDownToLine,
  AlertCircle,
  X,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { QRScannerModal } from "@/components/QRScannerModal";
import { useRelayTransfer } from "@/hooks/useRelayTransfer";

interface InternetSharingCardProps {
  initialRoomCode?: string;
}

export function InternetSharingCard({ initialRoomCode }: InternetSharingCardProps) {
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [otpInput, setOtpInput] = useState(initialRoomCode || "");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const autoReceivedRef = useRef(false);

  const {
    relayState,
    progress: relayProgress,
    relayCode,
    qrUrl,
    error: relayError,
    isDownloading,
    startRelayUpload,
    cancelRelay,
    receiveByOtp,
    reset,
  } = useRelayTransfer();

  // Auto-handle incoming URLs (?room=...#rc=...) on mount
  useEffect(() => {
    if (typeof window === "undefined" || autoReceivedRef.current) return;
    const fullUrl = window.location.href;
    const hash = window.location.hash || "";

    if (hash.includes("rc=") || fullUrl.includes("rc=")) {
      autoReceivedRef.current = true;
      receiveByOtp(fullUrl)
        .then(() => setDownloadSuccess(true))
        .catch(() => {});
    }
  }, [receiveByOtp]);

  const hasOversized = selectedPayload.files.some((f) => f.size > 52428800);
  const hasPayload = selectedPayload.files.length > 0 || Boolean(selectedPayload.text.trim());

  const handleSend = async () => {
    if (!hasPayload || hasOversized) return;
    await startRelayUpload(selectedPayload.files, selectedPayload.text);
  };

  const handleReceive = async () => {
    if (!otpInput.trim() || isDownloading) return;
    try {
      await receiveByOtp(otpInput.trim());
      setDownloadSuccess(true);
      setOtpInput("");
    } catch {
      // Error captured in relay hook
    }
  };

  const handleScanSuccess = async (scanned: string) => {
    setIsScannerOpen(false);
    try {
      await receiveByOtp(scanned);
      setDownloadSuccess(true);
    } catch {
      // Error captured in relay hook
    }
  };

  const handleCopyOtp = async () => {
    if (!relayCode) return;
    try {
      await navigator.clipboard.writeText(relayCode);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    } catch {
      // Ignore clipboard write error
    }
  };

  const handleReset = () => {
    reset();
    setDownloadSuccess(false);
    setSelectedPayload({ files: [], text: "" });
    setOtpInput("");
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Global Error Banner */}
      {relayError && (
        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{relayError}</span>
          </div>
          <button
            onClick={() => handleReset()}
            className="p-1 rounded-lg hover:bg-red-500/20 transition-all text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Downloading State */}
      {isDownloading && (
        <div className="flex flex-col items-center justify-center p-6 space-y-3 bg-[var(--surface-subtle)] rounded-3xl border border-[var(--border-hairline)] text-center">
          <RefreshCw className="h-7 w-7 text-[var(--accent)] animate-spin" />
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Receiving &amp; Decrypting...</p>
            <p className="text-xs text-[var(--text-muted)]">Verifying zero-knowledge encryption key</p>
          </div>
        </div>
      )}

      {/* Download Success State */}
      {!isDownloading && downloadSuccess && (
        <div className="flex flex-col items-center justify-center p-6 space-y-3 bg-emerald-500/10 border border-emerald-500/25 rounded-3xl text-center">
          <Check className="h-9 w-9 text-emerald-500 p-1.5 rounded-full bg-emerald-500/20" />
          <div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Transfer Completed!</p>
            <p className="text-xs text-[var(--text-muted)]">File downloaded and verified securely</p>
          </div>
          <button
            onClick={handleReset}
            className="px-5 py-2 rounded-xl bg-[var(--surface-glass)] hover:bg-[var(--border-hairline)] text-xs font-semibold text-[var(--text)] transition-all"
          >
            Done
          </button>
        </div>
      )}

      {/* Ready State: Crisp QR Code + 2-Column Row (Scan QR | Auto OTP) */}
      {!isDownloading && !downloadSuccess && relayState === "ready" && (
        <div className="flex flex-col items-center text-center space-y-4 p-5 bg-[var(--surface-card)] rounded-3xl border border-[var(--border-hairline)] shadow-sm">
          <QRCodeDisplay code={relayCode || ""} url={qrUrl || undefined} />

          <p className="text-xs text-[var(--text-muted)] -mt-1">
            Scan with any camera or enter the OTP on the other device
          </p>

          {/* 2-Column Row: Left Scan QR | Right Auto OTP */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-glass)] border border-[var(--border-hairline)] text-sm font-semibold transition-all active:scale-[0.98] text-[var(--text)]"
            >
              <Camera className="h-4 w-4 text-[var(--accent)]" />
              <span>Scan QR</span>
            </button>

            <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                  Auto OTP
                </span>
                <span className="font-mono font-bold text-base tracking-widest text-[var(--text)]">
                  {relayCode}
                </span>
              </div>
              <button
                onClick={handleCopyOtp}
                className="p-2 rounded-xl bg-[var(--surface-glass)] hover:bg-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all"
                title="Copy OTP"
              >
                {copiedOtp ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline transition-all pt-1"
          >
            Send another file
          </button>
        </div>
      )}

      {/* Preparing / Uploading State */}
      {!isDownloading && !downloadSuccess && (relayState === "encrypting" || relayState === "uploading") && (
        <div className="p-6 bg-[var(--surface-card)] rounded-3xl border border-[var(--border-hairline)] space-y-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text)]">
            <RefreshCw className="h-4 w-4 animate-spin text-[var(--accent)]" />
            <span>
              {relayState === "encrypting" ? "Encrypting with client-side AES-GCM..." : "Preparing secure transfer..."}
            </span>
          </div>

          {/* Smooth Progress Bar */}
          <div className="w-full h-2.5 bg-[var(--surface-subtle)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(relayProgress, 10)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>{relayProgress}% completed</span>
            <button
              onClick={() => cancelRelay()}
              className="text-red-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Idle / Sending State: Dropzone + Send button + 2-Column Row (Scan QR | Enter OTP) */}
      {!isDownloading && !downloadSuccess && relayState === "idle" && (
        <div className="space-y-4">
          {/* Dropzone Card */}
          <div className="p-4 bg-[var(--surface-card)] rounded-3xl border border-[var(--border-hairline)] shadow-sm space-y-3">
            <Dropzone onSelectionChange={setSelectedPayload} />

            {/* Oversized warning notice */}
            {hasOversized && (
              <p className="text-xs text-amber-500 font-medium text-center">
                Note: Files &gt;50 MB are best transferred via Same Wi-Fi, Hotspot, or Cable.
              </p>
            )}

            {/* Send Button when payload selected */}
            {hasPayload && (
              <button
                onClick={handleSend}
                disabled={hasOversized}
                className="w-full py-3.5 px-5 rounded-2xl bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
              >
                <Send className="h-4 w-4" />
                <span>
                  Send {selectedPayload.files.length > 0 ? `${selectedPayload.files.length} File${selectedPayload.files.length > 1 ? "s" : ""}` : "Text"}
                </span>
              </button>
            )}
          </div>

          {/* Idle / Receive Row: 2-Column Row below Dropzone */}
          <div className="p-3 bg-[var(--surface-card)] rounded-3xl border border-[var(--border-hairline)] shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              {/* Left Column: Scan QR */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-glass)] border border-[var(--border-hairline)] text-sm font-semibold transition-all active:scale-[0.98] text-[var(--text)]"
              >
                <Camera className="h-4 w-4 text-[var(--accent)]" />
                <span>Scan QR</span>
              </button>

              {/* Right Column: Enter OTP + Receive Button */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleReceive()}
                  placeholder="Enter OTP (e.g. K7M2-9QXA)"
                  className="w-full px-3.5 py-3 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-sm font-mono tracking-wider focus:outline-none focus:border-[var(--accent)] text-[var(--text)] placeholder:text-[var(--text-muted)] uppercase"
                />
                <button
                  onClick={handleReceive}
                  disabled={!otpInput.trim() || isDownloading}
                  className="px-4 py-3 rounded-2xl bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center gap-1.5 shrink-0"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  <span>Receive</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
