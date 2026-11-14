"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Camera, QrCode, X, RefreshCw, Eye } from "lucide-react";
import { QRScannerModal } from "@/components/QRScannerModal";
import { isOpticalSdp, decodeOpticalSdp } from "@/lib/opticalSdp";

interface OpticalHandshakeModalProps {
  isOpen: boolean;
  role: "sender" | "receiver";
  localPayloadQr?: string; // OPTSDP:... string to display
  onOfferScanned?: (decoded: ReturnType<typeof decodeOpticalSdp>) => void;
  onAnswerScanned?: (decoded: ReturnType<typeof decodeOpticalSdp>) => void;
  onClose: () => void;
  isConnecting?: boolean;
}

export function OpticalHandshakeModal({
  isOpen,
  role,
  localPayloadQr,
  onOfferScanned,
  onAnswerScanned,
  onClose,
  isConnecting = false,
}: OpticalHandshakeModalProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [step, setStep] = useState<"display" | "scan">(role === "sender" ? "display" : "scan");

  if (!isOpen) return null;

  const handleScanSuccess = (scannedText: string) => {
    if (!isOpticalSdp(scannedText)) {
      alert("Scanned QR is not an optical WebRTC handshake code. Please scan the corresponding screen.");
      return;
    }

    try {
      const decoded = decodeOpticalSdp(scannedText);
      if (role === "receiver" && decoded.desc.type === "offer") {
        onOfferScanned?.(decoded);
        setStep("display");
      } else if (role === "sender" && decoded.desc.type === "answer") {
        onAnswerScanned?.(decoded);
        onClose();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to parse optical SDP payload");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Camera-to-Camera Optical Handshake
              </h3>
              <p className="text-xs text-neutral-400 font-mono">100% Zero-Internet P2P Signaling</p>
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

        {/* Content based on Step */}
        {step === "display" && localPayloadQr ? (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm">
              <QRCodeSVG value={localPayloadQr} size={220} level="L" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {role === "sender" ? "Step 1: Show to Receiver" : "Step 2: Show to Sender"}
              </span>
              <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                {role === "sender"
                  ? "Point the receiver's phone camera at this QR code. Once scanned, the receiver will display an Answer QR code."
                  : "Hold this Answer QR code in front of the sender's camera to establish the direct connection."}
              </p>
            </div>

            {role === "sender" && (
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="h-4 w-4" />
                <span>Scan Receiver&apos;s Answer QR</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <QrCode className="h-10 w-10 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Scan Sender&apos;s Offer QR Code</h4>
              <p className="text-xs text-neutral-500 max-w-xs">
                Open your camera to scan the optical handshake QR code displayed on the sender&apos;s screen.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Camera className="h-4 w-4" />
              <span>Launch Camera Scanner</span>
            </button>
          </div>
        )}

        {isConnecting && (
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-amber-600 dark:text-amber-400">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Establishing optical peer connection...</span>
          </div>
        )}
      </div>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
