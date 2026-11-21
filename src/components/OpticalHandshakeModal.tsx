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
} from "lucide-react";
import { QRScannerModal } from "@/components/QRScannerModal";
import {
  splitOpticalFrames,
  decodeOpticalSdp,
  OpticalFrameCollector,
  formatHandshakeCode,
  stripHandshakeFormatting,
} from "@/lib/opticalSdp";

interface OpticalHandshakeModalProps {
  isOpen: boolean;
  role: "sender" | "receiver";
  localPayloadQr?: string; // Q4... or QS3:... or legacy OPTSDP:... string
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
  const hasAutoOpenedRef = useRef(false);

  // Manual typing input state
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isConnectingAnswer, setIsConnectingAnswer] = useState(false);

  // Auto-open camera scanner on Receiver Step 1 & sync state on modal open
  useEffect(() => {
    if (!isOpen) {
      hasAutoOpenedRef.current = false;
      return;
    }

    if (role === "receiver" && !localPayloadQr) {
      if (!hasAutoOpenedRef.current) {
        hasAutoOpenedRef.current = true;
        const timer = setTimeout(() => {
          setIsScannerOpen(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, role, localPayloadQr]);

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

  const displayedManualValue = useMemo(() => {
    if (manualInput.startsWith("QS3:") || manualInput.startsWith("OPTSDP:")) {
      return manualInput;
    }
    return formatHandshakeCode(manualInput);
  }, [manualInput]);

  if (!isOpen) return null;

  const handleModalClose = () => {
    setIsScannerOpen(false);
    setManualInput("");
    setManualError(null);
    setIsConnectingAnswer(false);
    onClose();
  };

  const handleCopyCode = async () => {
    if (localPayloadQr) {
      const codeToCopy = formatHandshakeCode(localPayloadQr) || localPayloadQr;
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualError(null);
    if (val.trim().startsWith("QS3:") || val.trim().startsWith("OPTSDP:")) {
      setManualInput(val.trim());
    } else {
      setManualInput(stripHandshakeFormatting(val));
    }
  };

  const handleApplyManualCode = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) {
      setManualError("Please enter the code from the other device");
      return;
    }

    try {
      setManualError(null);
      const decoded = decodeOpticalSdp(trimmed);
      setManualInput("");

      if (role === "receiver" && decoded.desc.type === "offer") {
        onOfferScanned?.(decoded);
        setStep("display");
      } else if (role === "sender" && decoded.desc.type === "answer") {
        setIsConnectingAnswer(true);
        onAnswerScanned?.(decoded);
      } else {
        setManualError(`Unexpected code for ${role}. Expected an ${role === "receiver" ? "offer" : "answer"}.`);
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
        setManualInput("");
        setManualError(null);

        if (role === "receiver" && decoded.desc.type === "offer") {
          onOfferScanned?.(decoded);
          setStep("display");
        } else if (role === "sender" && decoded.desc.type === "answer") {
          setIsConnectingAnswer(true);
          onAnswerScanned?.(decoded);
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
            onClick={handleModalClose}
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

            {/* Directly below QR: Compact visible subtle card showing code with Copy button */}
            <div className="w-full p-3 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-left space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  Camera not working? Type this code on the other device:
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                  title="Copy code"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-neutral-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-xs text-[var(--text)] select-all break-all tracking-wider leading-relaxed bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border-hairline)] max-h-24 overflow-y-auto">
                {formatHandshakeCode(localPayloadQr)}
              </div>
            </div>

            {/* Step Description Copy */}
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {role === "sender"
                  ? "Step 1 of 2: Scan this QR on the receiving device"
                  : "STEP 2 OF 2: FINAL STEP"}
              </span>
              <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                {role === "sender"
                  ? "Point the receiver's phone camera at this QR code. Once scanned, tap the button below to scan their response."
                  : "On the SENDER phone, tap 'Step 2: Scan Receiver's QR' or type this code — your file will transfer over Wi-Fi right away."}
              </p>
            </div>

            {role === "sender" && (
              <div className="w-full space-y-3">
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

                {/* Sender Step 2 Manual Typing Box */}
                <div className="w-full pt-2 border-t border-[var(--border-hairline)] text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-[var(--border-hairline)]" />
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      or type receiver&apos;s code manually
                    </span>
                    <div className="h-px flex-1 bg-[var(--border-hairline)]" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={displayedManualValue}
                        onChange={handleManualInputChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleApplyManualCode();
                        }}
                        placeholder="e.g. Q4AB - CDEF - ..."
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs font-mono tracking-wider text-[var(--text)] uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyManualCode}
                        disabled={!manualInput.trim()}
                        className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--bg)] font-semibold text-xs transition-colors cursor-pointer shadow-xs shrink-0"
                      >
                        Connect
                      </button>
                    </div>
                    {manualError && (
                      <p className="text-[11px] text-red-500 font-medium">{manualError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
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

            {/* Receiver Step 1 Manual Typing Box */}
            <div className="w-full pt-2 border-t border-[var(--border-hairline)] text-left space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--border-hairline)]" />
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  or type sender&apos;s code manually
                </span>
                <div className="h-px flex-1 bg-[var(--border-hairline)]" />
              </div>

              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayedManualValue}
                    onChange={handleManualInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApplyManualCode();
                    }}
                    placeholder="e.g. Q4AB - CDEF - ..."
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs font-mono tracking-wider text-[var(--text)] uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyManualCode}
                    disabled={!manualInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--bg)] font-semibold text-xs transition-colors cursor-pointer shadow-xs shrink-0"
                  >
                    Connect
                  </button>
                </div>
                {manualError && (
                  <p className="text-[11px] text-red-500 font-medium">{manualError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {(isConnecting || isConnectingAnswer) && (
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 py-1 animate-in fade-in">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Connecting over Wi-Fi Hotspot...</span>
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
