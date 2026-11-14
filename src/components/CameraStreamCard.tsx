"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { Dropzone } from "@/components/Dropzone";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  encodeFileToOpticalFrames,
  encodeTextToOpticalFrames,
  OpticalDataCollector,
  isOpticalDataFrame,
  type OpticalDataFrame,
  type ReassembledPayload,
} from "@/lib/opticalDataStream";
import { useTransferHistory } from "@/hooks/useTransferHistory";
import { formatBytes } from "@/lib/chunker";

type OpticalRole = "send" | "receive";

export function CameraStreamCard() {
  const [role, setRole] = useState<OpticalRole>("send");

  // Sender state
  const [frames, setFrames] = useState<OpticalDataFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMs, setSpeedMs] = useState<number>(320); // 320ms normal speed
  const [isEncoding, setIsEncoding] = useState(false);

  // Receiver state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [receivedPayload, setReceivedPayload] = useState<ReassembledPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    fileName: string;
    fileSize: number;
    totalChunks: number;
    receivedCount: number;
    percentage: number;
    missingIndices: number[];
  } | null>(null);

  const { addHistoryItem } = useTransferHistory();
  const collectorRef = useRef<OpticalDataCollector>(new OpticalDataCollector());
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const readerElementId = "camera-optical-viewfinder";

  // Handle encoding when payload is selected in sender mode
  const handlePayloadSelected = useCallback(async (payload: { files: File[]; text: string }) => {
    setIsEncoding(true);
    try {
      let encoded: OpticalDataFrame[] = [];
      if (payload.files.length > 0) {
        // Encode primary selected file
        encoded = await encodeFileToOpticalFrames(payload.files[0]);
      } else if (payload.text.trim()) {
        encoded = await encodeTextToOpticalFrames(payload.text.trim());
      }
      setFrames(encoded);
      setCurrentFrameIndex(0);
      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to encode payload to optical frames:", err);
    } finally {
      setIsEncoding(false);
    }
  }, []);

  // Frame cycling loop for sender
  useEffect(() => {
    if (role !== "send" || frames.length <= 1 || !isPlaying) {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      return;
    }

    playbackTimerRef.current = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
    }, speedMs);

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [role, frames.length, isPlaying, speedMs]);

  // Handle receiver camera initialization and scanning
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setReceivedPayload(null);
    setScanProgress(null);
    collectorRef.current.reset();

    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // Ignore stop errors
        }
      }

      const scanner = new Html5Qrcode(readerElementId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        async (decodedText) => {
          if (!isOpticalDataFrame(decodedText)) return;

          const res = await collectorRef.current.ingestFrame(decodedText);
          if (res.status === "collecting") {
            setScanProgress({
              fileName: res.fileName,
              fileSize: res.fileSize,
              totalChunks: res.totalChunks,
              receivedCount: res.receivedCount,
              percentage: res.percentage,
              missingIndices: res.missingIndices,
            });
          } else if (res.status === "completed") {
            setReceivedPayload(res.payload);
            setScanProgress(null);

            // Record to session history
            addHistoryItem({
              direction: "received",
              mode: "Via Camera",
              itemType: res.payload.text ? "text" : "file",
              name: res.payload.fileName,
              size: res.payload.fileSize,
              status: "completed",
              textSnippet: res.payload.text?.substring(0, 100),
            });

            // Stop scanner cleanly
            try {
              await scanner.stop();
              setIsCameraActive(false);
            } catch {
              // Ignore
            }

            // Auto-trigger download for files
            if (!res.payload.text) {
              const url = URL.createObjectURL(res.payload.blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = res.payload.fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }
          }
        },
        () => {
          // Frame failure (normal when scanning continuous stream)
        }
      );

      setIsCameraActive(true);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : "Camera access was denied or is not available. Please allow camera permissions."
      );
      setIsCameraActive(false);
    }
  }, [addHistoryItem]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignore
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Cleanup camera when component unmounts
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleDownloadReceived = () => {
    if (!receivedPayload) return;
    const url = URL.createObjectURL(receivedPayload.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = receivedPayload.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleCopyText = async () => {
    if (!receivedPayload?.text) return;
    try {
      await navigator.clipboard.writeText(receivedPayload.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Role Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-[var(--text)]">Via Camera Scan</h3>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              100% Offline
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Zero-network air-gapped data transfer. Stream files as animated QR codes to any phone or laptop camera.
          </p>
        </div>

        <SegmentedControl
          value={role}
          onChange={(newRole) => {
            if (newRole !== "receive") {
              stopCamera();
            }
            setRole(newRole as OpticalRole);
            setReceivedPayload(null);
            setScanProgress(null);
          }}
          options={[
            { value: "send", label: "Stream / Send" },
            { value: "receive", label: "Scan / Receive" },
          ]}
          ariaLabel="Optical camera transfer role"
        />
      </div>

      {/* SENDER VIEW */}
      {role === "send" && (
        <div className="space-y-6">
          {isEncoding ? (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl text-center space-y-2">
              <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium text-[var(--text)]">Compressing & generating optical QR stream...</span>
            </div>
          ) : frames.length === 0 ? (
            <div className="space-y-3">
              <Dropzone onSelectionChange={handlePayloadSelected} />
              <p className="text-[11px] text-center text-[var(--text-muted)]">
                Files are compressed and converted into a sequenced stream of QR codes. Point the receiver camera at the screen to capture.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* QR Display Card */}
              <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200">
                  <QRCodeSVG
                    value={frames[currentFrameIndex]?.encodedPayload || ""}
                    size={260}
                    level="L"
                    includeMargin={false}
                  />
                </div>

                {/* Frame Counter & Progress Bar */}
                <div className="w-full max-w-sm mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text)] truncate max-w-[200px]">
                      {frames[0]?.fileName}
                    </span>
                    <span className="font-mono tabular-nums text-[11px]">
                      Frame {currentFrameIndex + 1} of {frames.length}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-150"
                      style={{
                        width: `${((currentFrameIndex + 1) / frames.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Playback & Speed Controls */}
                <div className="flex items-center gap-2 mt-5">
                  <button
                    onClick={() =>
                      setCurrentFrameIndex((prev) => (prev - 1 + frames.length) % frames.length)
                    }
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                    title="Previous Frame"
                    aria-label="Previous Frame"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsPlaying((prev) => !prev)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--text)] text-[var(--surface)] font-medium text-xs shadow-sm hover:opacity-90 transition-opacity"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Play
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setCurrentFrameIndex((prev) => (prev + 1) % frames.length)}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                    title="Next Frame"
                    aria-label="Next Frame"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="h-4 w-px bg-[var(--border-hairline)] mx-1" />

                  {/* Speed Selector */}
                  <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border-hairline)]">
                    <button
                      onClick={() => setSpeedMs(500)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                        speedMs === 500
                          ? "bg-[var(--text)] text-[var(--surface)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      Slow
                    </button>
                    <button
                      onClick={() => setSpeedMs(320)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                        speedMs === 320
                          ? "bg-[var(--text)] text-[var(--surface)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setSpeedMs(220)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                        speedMs === 220
                          ? "bg-[var(--text)] text-[var(--surface)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      Fast
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset action */}
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setFrames([]);
                  }}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Choose another file or text
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RECEIVER VIEW */}
      {role === "receive" && (
        <div className="space-y-6">
          {!receivedPayload ? (
            <div className="space-y-4">
              {/* Viewfinder or Camera Trigger */}
              <div className="relative flex flex-col items-center justify-center p-6 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl min-h-[320px]">
                <div
                  id={readerElementId}
                  className={`w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden bg-black/5 dark:bg-black/30 border border-[var(--border-hairline)] ${
                    isCameraActive ? "block" : "hidden"
                  }`}
                />

                {!isCameraActive && (
                  <div className="flex flex-col items-center text-center max-w-xs space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent)] shadow-sm">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[var(--text)]">Point Camera at QR Stream</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Opens your device camera to continuously capture sequenced QR frames until the file is fully assembled.
                      </p>
                    </div>

                    <button
                      onClick={startCamera}
                      className="px-5 py-2.5 rounded-xl bg-[var(--text)] text-[var(--surface)] font-medium text-xs shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" /> Start Camera Scanner
                    </button>
                  </div>
                )}

                {cameraError && (
                  <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center max-w-sm">
                    {cameraError}
                  </div>
                )}
              </div>

              {/* Live Collection Progress */}
              {scanProgress && (
                <div className="p-4 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[var(--text)]">{scanProgress.fileName}</span>
                      <span className="text-[var(--text-muted)] ml-2">
                        ({formatBytes(scanProgress.fileSize)})
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-[var(--accent)] font-semibold">
                      {scanProgress.receivedCount} / {scanProgress.totalChunks} Chunks ({scanProgress.percentage}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-150"
                      style={{ width: `${scanProgress.percentage}%` }}
                    />
                  </div>

                  {/* Visual Chunk Grid */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {Array.from({ length: scanProgress.totalChunks }).map((_, idx) => {
                      const isCollected = !scanProgress.missingIndices.includes(idx);
                      return (
                        <div
                          key={idx}
                          className={`w-3.5 h-3.5 rounded-md transition-colors ${
                            isCollected
                              ? "bg-emerald-500 shadow-xs"
                              : "bg-neutral-200 dark:bg-neutral-800"
                          }`}
                          title={`Chunk ${idx + 1}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Completed Reassembled View */
            <div className="p-6 sm:p-8 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-xs">
                <Check className="w-7 h-7" />
              </div>

              <div>
                <h4 className="font-bold text-base text-[var(--text)]">Transfer Complete!</h4>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Air-gapped optical payload was assembled with 100% data integrity.
                </p>
              </div>

              <div className="p-4 bg-[var(--surface)] border border-[var(--border-hairline)] rounded-xl max-w-sm mx-auto text-left">
                <div className="font-medium text-xs text-[var(--text)] truncate">
                  {receivedPayload.fileName}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {formatBytes(receivedPayload.fileSize)} • {receivedPayload.mimeType}
                </div>

                {receivedPayload.text && (
                  <div className="mt-3 p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-hairline)] font-mono text-xs max-h-32 overflow-y-auto whitespace-pre-wrap break-all text-[var(--text)]">
                    {receivedPayload.text}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {receivedPayload.text ? (
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--text)] text-[var(--surface)] font-medium text-xs shadow-sm hover:opacity-90 transition-opacity"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Text"}
                  </button>
                ) : (
                  <button
                    onClick={handleDownloadReceived}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--text)] text-[var(--surface)] font-medium text-xs shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-4 h-4" /> Download File
                  </button>
                )}

                <button
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] font-medium text-xs hover:bg-[var(--surface-subtle)] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Scan Another File
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
