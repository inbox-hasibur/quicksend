"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Camera,
  QrCode,
  X,
  RefreshCw,
  Eye,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Copy,
  Check,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { QRScannerModal } from "@/components/QRScannerModal";
import {
  splitOpticalFrames,
  decodeOpticalSdp,
  OpticalFrameCollector,
} from "@/lib/opticalSdp";

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

  // Animated Carousel state
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<"normal" | "slow">("normal");

  // Scan progress state
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const collectorRef = useRef(new OpticalFrameCollector());

  // Manual fallback state
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Split local payload into sequenced optical frames (180 chars max for high readability)
  const frames = useMemo(() => {
    if (!localPayloadQr) return [];
    return splitOpticalFrames(localPayloadQr, 180);
  }, [localPayloadQr]);

  const activeFrameIndex = frames.length > 0 ? currentFrameIndex % frames.length : 0;

  // Animated cycling interval
  useEffect(() => {
    if (!isOpen || step !== "display" || !isPlaying || frames.length <= 1) {
      return;
    }

    const intervalMs = speed === "normal" ? 350 : 700;
    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isOpen, step, isPlaying, speed, frames.length]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    if (localPayloadQr) {
      await navigator.clipboard.writeText(localPayloadQr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyManualCode = () => {
    const trimmed = manualCodeInput.trim();
    if (!trimmed) {
      setManualError("Please paste an optical handshake code");
      return;
    }

    try {
      setManualError(null);
      const decoded = decodeOpticalSdp(trimmed);
      if (role === "receiver" && decoded.desc.type === "offer") {
        onOfferScanned?.(decoded);
        setStep("display");
      } else if (role === "sender" && decoded.desc.type === "answer") {
        onAnswerScanned?.(decoded);
        onClose();
      } else {
        setManualError(`Unexpected payload type "${decoded.desc.type}" for ${role}`);
      }
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Invalid handshake code");
    }
  };

  const handleScanSuccess = (scannedText: string) => {
    const result = collectorRef.current.addFrame(scannedText);
    setScanProgress(result.progress);

    if (result.complete && result.payload) {
      try {
        const decoded = decodeOpticalSdp(result.payload);
        collectorRef.current.reset();
        setScanProgress({ current: 0, total: 0 });
        setIsScannerOpen(false);

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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-2xl space-y-5">
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
            {/* QR Card */}
            <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm relative">
              <QRCodeSVG
                value={frames[activeFrameIndex] || localPayloadQr}
                size={220}
                level="L"
              />
            </div>

            {/* Carousel Controls (if multi-frame) */}
            {frames.length > 1 && (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold">
                      Frame {activeFrameIndex + 1} / {frames.length}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      ({speed === "normal" ? "~350ms" : "~700ms"})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSpeed(speed === "normal" ? "slow" : "normal")}
                      className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Adjust animation speed"
                    >
                      <Gauge className="h-3 w-3" />
                      <span>{speed === "normal" ? "Normal" : "Slow"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                      title={isPlaying ? "Pause cycle" : "Resume cycle"}
                    >
                      {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Frame Step Chevrons */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentFrameIndex((prev) => (prev - 1 + frames.length) % frames.length)
                    }
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {frames.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i === activeFrameIndex
                            ? "w-4 bg-amber-500"
                            : "w-1.5 bg-neutral-300 dark:bg-neutral-700"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentFrameIndex((prev) => (prev + 1) % frames.length)}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {role === "sender" ? "Step 1: Show to Receiver" : "Step 2: Show to Sender"}
              </span>
              <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                {role === "sender"
                  ? "Point the receiver's phone camera at this animated QR code. Once scanned, the receiver will display an Answer QR."
                  : "Hold this Answer QR code in front of the sender's camera to establish the direct connection."}
              </p>
            </div>

            {role === "sender" && (
              <button
                type="button"
                onClick={() => {
                  collectorRef.current.reset();
                  setScanProgress({ current: 0, total: 0 });
                  setIsScannerOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                <span>Scan Receiver&apos;s Answer QR</span>
              </button>
            )}

            {/* Webcam-Free Fallback: Copy Code */}
            <div className="w-full pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied Handshake Code!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-neutral-400" />
                    <span>No camera? Copy Handshake Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* SCAN STEP */
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <QrCode className="h-10 w-10 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                Scan Sender&apos;s Offer QR Code
              </h4>
              <p className="text-xs text-neutral-500 max-w-xs">
                Open your camera to scan the optical handshake QR code displayed on the sender&apos;s screen.
              </p>
            </div>

            {scanProgress.total > 0 && (
              <div className="w-full p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-mono text-indigo-700 dark:text-indigo-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Captured:</span>
                  <span className="font-bold">
                    {scanProgress.current} of {scanProgress.total} frames
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-150"
                    style={{
                      width: `${Math.round((scanProgress.current / scanProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                collectorRef.current.reset();
                setScanProgress({ current: 0, total: 0 });
                setIsScannerOpen(true);
              }}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Camera className="h-4 w-4" />
              <span>Launch Camera Scanner</span>
            </button>

            {/* Webcam-Free Fallback: Expandable Paste Code */}
            <div className="w-full pt-2 border-t border-neutral-100 dark:border-neutral-800 text-left">
              <button
                type="button"
                onClick={() => setShowManualFallback(!showManualFallback)}
                className="w-full py-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center justify-between cursor-pointer"
              >
                <span>No camera? Paste Code manually</span>
                {showManualFallback ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showManualFallback && (
                <div className="mt-2 space-y-2 animate-in fade-in">
                  <textarea
                    rows={3}
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder="Paste OPTSDP:... code here"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-mono text-neutral-800 dark:text-neutral-200 resize-none"
                  />
                  {manualError && (
                    <p className="text-[11px] text-red-500 font-medium">{manualError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleApplyManualCode}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>Apply Handshake Code</span>
                  </button>
                </div>
              )}
            </div>
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
        keepOpenOnScan={true}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
