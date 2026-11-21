"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Camera,
  QrCode,
  X,
  RefreshCw,
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
  localPayloadQr?: string; // QS3:... or legacy OPTSDP:... string
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

  // Multi-frame Carousel fallback state (only when payload > 450 chars)
  const isMultiFrame = Boolean(localPayloadQr && localPayloadQr.length > 450);
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

  // Split local payload into sequenced optical frames only if multi-frame needed
  const frames = useMemo(() => {
    if (!localPayloadQr || !isMultiFrame) return [];
    return splitOpticalFrames(localPayloadQr, 180);
  }, [localPayloadQr, isMultiFrame]);

  const activeFrameIndex = frames.length > 0 ? currentFrameIndex % frames.length : 0;

  // Animated cycling interval (only active when multi-frame)
  useEffect(() => {
    if (!isOpen || step !== "display" || !isPlaying || !isMultiFrame || frames.length <= 1) {
      return;
    }

    const intervalMs = speed === "normal" ? 350 : 700;
    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isOpen, step, isPlaying, speed, isMultiFrame, frames.length]);

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
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[var(--text)]">
                Connect via Hotspot QR
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Direct Wi-Fi transfer • No internet needed
              </p>
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

        {/* Content based on Step */}
        {step === "display" && localPayloadQr ? (
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Single Static QR Code (level="L", size={240}) */}
            <div className="p-3 bg-white rounded-2xl border border-[var(--border-hairline)] shadow-sm relative">
              <QRCodeSVG
                value={isMultiFrame ? (frames[activeFrameIndex] || localPayloadQr) : localPayloadQr}
                size={240}
                level="L"
              />
            </div>

            {/* Carousel Controls (ONLY rendered if multi-frame > 450 chars) */}
            {isMultiFrame && frames.length > 1 && (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold">
                      Frame {activeFrameIndex + 1} / {frames.length}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      ({speed === "normal" ? "~350ms" : "~700ms"})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSpeed(speed === "normal" ? "slow" : "normal")}
                      className="px-2 py-1 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--surface-muted)] text-[11px] font-semibold text-[var(--text)] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Adjust animation speed"
                    >
                      <Gauge className="h-3 w-3" />
                      <span>{speed === "normal" ? "Normal" : "Slow"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1.5 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--surface-muted)] text-[var(--text)] transition-colors cursor-pointer"
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

            {/* Step Description Copy */}
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {role === "sender"
                  ? "Step 1 of 2: Scan this QR on the receiving device"
                  : "Step 2 of 2: Show this QR to Sender"}
              </span>
              <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                {role === "sender"
                  ? "Point the receiver's phone camera at this QR code. Once scanned, tap the button below to scan their response."
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
                className="w-full py-3 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Camera className="h-4 w-4" />
                <span>Step 2: Scan Receiver&apos;s QR</span>
              </button>
            )}

            {/* Collapsible Copy / Paste Code Fallback */}
            <div className="w-full pt-2 border-t border-[var(--border-hairline)] text-left">
              <button
                type="button"
                onClick={() => setShowManualFallback(!showManualFallback)}
                className="w-full py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-between cursor-pointer"
              >
                <span>No camera? Copy / Paste Code</span>
                {showManualFallback ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showManualFallback && (
                <div className="mt-2 space-y-2 animate-in fade-in">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="w-full py-2 px-3 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)] text-[var(--text)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Copied Handshake Code!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Copy This Device&apos;s Handshake Code</span>
                      </>
                    )}
                  </button>

                  <div className="space-y-1.5 pt-1">
                    <textarea
                      rows={3}
                      value={manualCodeInput}
                      onChange={(e) => setManualCodeInput(e.target.value)}
                      placeholder="Paste other device's code here (QS3:...)"
                      className="w-full p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[11px] font-mono text-[var(--text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    {manualError && (
                      <p className="text-[11px] text-red-500 font-medium">{manualError}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleApplyManualCode}
                      className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      <span>Apply Handshake Code</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SCAN STEP (Receiver Step 1) */
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] text-[var(--accent)]">
              <QrCode className="h-10 w-10 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-[var(--text)]">
                Step 1 of 2: Scan Sender&apos;s QR
              </h4>
              <p className="text-xs text-[var(--text-muted)] max-w-xs">
                Open your camera to scan the QR code displayed on the sender&apos;s screen.
              </p>
            </div>

            {scanProgress.total > 1 && (
              <div className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-700 dark:text-amber-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Captured:</span>
                  <span className="font-bold">
                    {scanProgress.current} of {scanProgress.total} frames
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-150"
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
              className="w-full py-3 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Camera className="h-4 w-4" />
              <span>Launch Camera Scanner</span>
            </button>

            {/* Collapsible Copy / Paste Code Fallback */}
            <div className="w-full pt-2 border-t border-[var(--border-hairline)] text-left">
              <button
                type="button"
                onClick={() => setShowManualFallback(!showManualFallback)}
                className="w-full py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-between cursor-pointer"
              >
                <span>No camera? Copy / Paste Code</span>
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
                    placeholder="Paste other device's code here (QS3:...)"
                    className="w-full p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[11px] font-mono text-[var(--text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  {manualError && (
                    <p className="text-[11px] text-red-500 font-medium">{manualError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleApplyManualCode}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
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
