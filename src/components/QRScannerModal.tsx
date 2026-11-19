"use client";

import { useEffect, useRef, useCallback } from "react";
import { Camera, X, AlertCircle, RefreshCw } from "lucide-react";
import { normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import { isOpticalSdp } from "@/lib/opticalSdp";
import { useHtml5Scanner } from "@/hooks/useHtml5Scanner";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
  keepOpenOnScan?: boolean;
}

export function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  keepOpenOnScan = false,
}: QRScannerModalProps) {
  const { containerRef, start, stop, isRunning, isStarting, error: scannerError } = useHtml5Scanner();
  const completedRef = useRef(false);

  const handleDecode = useCallback(
    async (decodedText: string) => {
      if (completedRef.current) return;

      // Check if scanned text is an optical SDP frame or package
      if (isOpticalSdp(decodedText)) {
        if (!keepOpenOnScan) {
          completedRef.current = true;
          await stop();
          onScanSuccess(decodedText);
          onClose();
        } else {
          onScanSuccess(decodedText);
        }
        return;
      }

      // Preserve #otp= hash URLs and 6-digit numeric OTPs
      if (decodedText.includes("#otp=") || decodedText.includes("otp=")) {
        completedRef.current = true;
        await stop();
        onScanSuccess(decodedText);
        onClose();
        return;
      }

      if (/^\d{3}[-\s]?\d{3}$/.test(decodedText.trim())) {
        completedRef.current = true;
        await stop();
        onScanSuccess(decodedText.trim().replace(/[-\s]/g, ""));
        onClose();
        return;
      }

      // Check if scanned text contains a room query param (e.g. https://.../?room=834291)
      let extractedCode = "";
      try {
        if (decodedText.includes("room=")) {
          const url = new URL(decodedText);
          extractedCode = url.searchParams.get("room") || "";
        } else {
          extractedCode = decodedText;
        }
      } catch {
        extractedCode = decodedText;
      }

      const clean = normalizeRoomCode(extractedCode);
      if (isValidRoomCode(clean)) {
        completedRef.current = true;
        await stop();
        if (decodedText.includes("rc=") || decodedText.includes("#rc=")) {
          onScanSuccess(decodedText);
        } else {
          onScanSuccess(clean);
        }
        onClose();
      }
    },
    [keepOpenOnScan, onClose, onScanSuccess, stop]
  );

  useEffect(() => {
    if (!isOpen) return;
    completedRef.current = false;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    // Fast microtask delay to ensure modal DOM container is mounted
    const timeout = setTimeout(() => {
      start(handleDecode, config).catch(() => {});
    }, 50);

    return () => {
      clearTimeout(timeout);
      stop().catch(() => {});
    };
  }, [isOpen, handleDecode, start, stop]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      translate="no"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[var(--text)]">
                Scan Room QR Code
              </h3>
              <p className="text-xs text-[var(--text-muted)]">Point your camera at the sender&apos;s QR code</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative overflow-hidden rounded-xl bg-black min-h-[280px] flex items-center justify-center">
          {/* Scanner container is isolated from React - zero React children */}
          <div
            ref={containerRef}
            className={`w-full h-full qs-scanner transition-opacity ${
              !isRunning ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          />

          {isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 text-white gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
              <span className="text-xs font-medium">Starting camera...</span>
            </div>
          )}

          {scannerError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 text-white p-6 text-center gap-2">
              <AlertCircle className="h-8 w-8 text-amber-400" />
              <p className="text-xs text-neutral-300 leading-relaxed">{scannerError}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 px-4 py-1.5 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text)] border border-[var(--border-hairline)] text-xs font-semibold transition-colors cursor-pointer"
              >
                Close &amp; Enter PIN Manually
              </button>
            </div>
          )}
        </div>

        {/* Footer Guidance */}
        <p className="text-xs text-neutral-400 text-center mt-4">
          Once detected, pairing and peer transfer initiates automatically.
        </p>
      </div>
    </div>
  );
}
