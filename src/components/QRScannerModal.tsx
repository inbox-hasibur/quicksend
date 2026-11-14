"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, AlertCircle, RefreshCw } from "lucide-react";
import { normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import { isOpticalSdp } from "@/lib/opticalSdp";

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-viewport";

  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;

    const startScanner = async () => {
      try {
        setIsStarting(true);
        setErrorMsg(null);
        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (!isSubscribed) return;

            // Check if scanned text is an optical SDP frame or package
            if (isOpticalSdp(decodedText)) {
              onScanSuccess(decodedText);
              if (!keepOpenOnScan) {
                scanner.stop().catch(() => {});
                onClose();
              }
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
              scanner.stop().catch(() => {});
              onScanSuccess(clean);
              onClose();
            }
          },
          () => {
            // Frame scan failure (ignore continuous frame attempts)
          }
        );

        if (isSubscribed) {
          setIsStarting(false);
        }
      } catch (err) {
        if (isSubscribed) {
          setIsStarting(false);
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Unable to access camera. Please verify camera permissions or type the 6-digit PIN manually."
          );
        }
      }
    };

    // Fast microtask delay to ensure modal DOM container is mounted
    const timeout = setTimeout(startScanner, 50);

    return () => {
      isSubscribed = false;
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
          });
      }
    };
  }, [isOpen, onClose, onScanSuccess, keepOpenOnScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Scan Room QR Code
              </h3>
              <p className="text-xs text-neutral-400">Point your camera at the sender&apos;s QR code</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative overflow-hidden rounded-xl bg-black min-h-[280px] flex items-center justify-center">
          <div id={readerId} className="w-full" />

          {isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 text-white gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
              <span className="text-xs font-medium">Starting camera...</span>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 text-white p-6 text-center gap-2">
              <AlertCircle className="h-8 w-8 text-amber-400" />
              <p className="text-xs text-neutral-300 leading-relaxed">{errorMsg}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 px-4 py-1.5 rounded-lg bg-neutral-800 text-xs font-semibold hover:bg-neutral-700 transition-colors"
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
