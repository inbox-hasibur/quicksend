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
  AlertTriangle,
  Upload,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { Dropzone } from "@/components/Dropzone";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  encodeFileToOpticalFrames,
  encodeTextToOpticalFrames,
  OpticalDataCollector,
  OPTICAL_CHUNK_PRESETS,
  type OpticalChunkPreset,
  type OpticalDataFrame,
  type ReassembledPayload,
} from "@/lib/opticalDataStream";
import { useTransferHistory } from "@/hooks/useTransferHistory";
import { formatBytes } from "@/lib/chunker";

type OpticalRole = "send" | "receive";

export function CameraStreamCard() {
  const [role, setRole] = useState<OpticalRole>("send");

  // Sender state (Starts paused on Frame 1 by default)
  const [frames, setFrames] = useState<OpticalDataFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(320); // 320ms normal speed
  const [isEncoding, setIsEncoding] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<OpticalChunkPreset>("medium");
  const [activePayload, setActivePayload] = useState<{ files: File[]; text: string } | null>(null);

  // Receiver state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastDetected, setLastDetected] = useState<{
    isOptical: boolean;
    frameIndex?: number;
    totalFrames?: number;
    timestamp: number;
  } | null>(null);
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
  const isStartingRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const shouldStopRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedTextRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const lastUiUpdateRef = useRef<number>(0);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingProgressRef = useRef<{
    fileName: string;
    fileSize: number;
    totalChunks: number;
    receivedCount: number;
    percentage: number;
    missingIndices: number[];
  } | null>(null);
  const createdBlobUrlsRef = useRef<string[]>([]);
  const readerElementId = "camera-optical-viewfinder";

  // Re-encode payload with given chunk preset
  const encodePayload = useCallback(
    async (payload: { files: File[]; text: string }, preset: OpticalChunkPreset) => {
      setIsEncoding(true);
      try {
        let encoded: OpticalDataFrame[] = [];
        const chunkSize = OPTICAL_CHUNK_PRESETS[preset];
        if (payload.files.length > 0) {
          encoded = await encodeFileToOpticalFrames(payload.files[0], chunkSize);
        } else if (payload.text.trim()) {
          encoded = await encodeTextToOpticalFrames(payload.text.trim(), chunkSize);
        }
        setFrames(encoded);
        setCurrentFrameIndex(0);
        setIsPlaying(false);
        setHasStartedStreaming(false);
      } catch (err) {
        console.error("Failed to encode payload to optical frames:", err);
      } finally {
        setIsEncoding(false);
      }
    },
    []
  );

  // Handle payload selection in sender mode
  const handlePayloadSelected = useCallback(
    async (payload: { files: File[]; text: string }) => {
      setActivePayload(payload);
      await encodePayload(payload, selectedPreset);
    },
    [encodePayload, selectedPreset]
  );

  // Handle QR density preset changes
  const handlePresetChange = useCallback(
    async (newPreset: OpticalChunkPreset) => {
      setSelectedPreset(newPreset);
      if (activePayload) {
        await encodePayload(activePayload, newPreset);
      }
    },
    [activePayload, encodePayload]
  );

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

  // Reusable frame processor for both live camera frames and image uploads
  const processDecodedFrame = useCallback(
    async (decodedText: string) => {
      // Wrap entire success callback in try/catch to avoid crashes
      try {
        const now = Date.now();

        // Ignore identical frame text if received within 100ms
        if (
          decodedText === lastScannedTextRef.current &&
          now - lastScannedTimeRef.current < 100
        ) {
          return;
        }
        lastScannedTextRef.current = decodedText;
        lastScannedTimeRef.current = now;

        // Ingest frame into collector ref directly
        const res = await collectorRef.current.add(decodedText);

        if (res.status === "invalid") {
          setLastDetected({ isOptical: false, timestamp: now });
          return;
        }

        if (res.status === "error") {
          setCameraError(res.error);
          return;
        }

        if (res.status === "collecting") {
          setCameraError(null);
          setLastDetected({
            isOptical: true,
            frameIndex: res.receivedCount,
            totalFrames: res.totalChunks,
            timestamp: now,
          });

          // Schedule throttled state update (max 5 updates per second = 200ms)
          pendingProgressRef.current = {
            fileName: res.fileName,
            fileSize: res.fileSize,
            totalChunks: res.totalChunks,
            receivedCount: res.receivedCount,
            percentage: res.percentage,
            missingIndices: res.missingIndices,
          };

          if (now - lastUiUpdateRef.current >= 200) {
            lastUiUpdateRef.current = now;
            setScanProgress(pendingProgressRef.current);
          } else if (!throttleTimerRef.current) {
            throttleTimerRef.current = setTimeout(() => {
              throttleTimerRef.current = null;
              lastUiUpdateRef.current = Date.now();
              if (pendingProgressRef.current) {
                setScanProgress(pendingProgressRef.current);
              }
            }, 200 - (now - lastUiUpdateRef.current));
          }
        } else if (res.status === "completed") {
          if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
          }

          // Stop camera scanner first
          if (scannerRef.current) {
            try {
              await scannerRef.current.stop();
              await scannerRef.current.clear();
            } catch {
              // Ignore stop errors
            }
            scannerRef.current = null;
            setIsCameraActive(false);
          }

          // Finalize inside try/catch
          try {
            setReceivedPayload(res.payload);
            setScanProgress(null);
            setCameraError(null);

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
          } catch (finalizeErr) {
            setCameraError(
              finalizeErr instanceof Error
                ? finalizeErr.message
                : "Failed to finalize received payload."
            );
          }
        }
      } catch (err) {
        setCameraError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while processing optical frame."
        );
      }
    },
    [addHistoryItem]
  );

  // Handle receiver camera initialization and scanning
  const startCamera = useCallback(
    async (overrideCameraId?: string) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      shouldStopRef.current = false;
      setIsCameraStarting(true);
      setCameraError(null);
      setReceivedPayload(null);
      setScanProgress(null);
      setLastDetected(null);
      collectorRef.current.reset();
      lastScannedTextRef.current = "";
      lastScannedTimeRef.current = 0;

      // Check secure context / mediaDevices support (e.g. non-HTTPS local IP)
      if (
        typeof window !== "undefined" &&
        !navigator?.mediaDevices &&
        !window.isSecureContext
      ) {
        setCameraError(
          "Camera access requires HTTPS or localhost. If opening over local IP, use 'Scan from Screenshot / Image' below."
        );
        isStartingRef.current = false;
        setIsCameraStarting(false);
        return;
      }

      try {
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
            await scannerRef.current.clear();
          } catch {
            // Ignore stop errors
          }
          scannerRef.current = null;
        }

        // Enumerate cameras if supported
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            setAvailableCameras(
              cameras.map((c, i) => ({
                id: c.id,
                label: c.label || `Camera ${i + 1}`,
              }))
            );
          }
        } catch {
          // Ignore camera enumeration failure
        }

        const scanner = new Html5Qrcode(readerElementId);
        scannerRef.current = scanner;

        // Html5Qrcode config: fps 15, no qrbox restriction (scan full frame), disableFlip true, ideal 1280x720
        const scanConfig = {
          fps: 15,
          disableFlip: true,
          videoConstraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const targetCamera = overrideCameraId || selectedCameraId;

        if (targetCamera) {
          await scanner.start(
            targetCamera,
            scanConfig,
            (decodedText) => {
              processDecodedFrame(decodedText);
            },
            () => {}
          );
        } else {
          // 1. Try environment (back) camera first
          try {
            await scanner.start(
              { facingMode: "environment" },
              scanConfig,
              (decodedText) => {
                processDecodedFrame(decodedText);
              },
              () => {}
            );
          } catch {
            // 2. Fallback to user (front/laptop) camera
            try {
              await scanner.start(
                { facingMode: "user" },
                scanConfig,
                (decodedText) => {
                  processDecodedFrame(decodedText);
                },
                () => {}
              );
            } catch {
              // 3. Fallback to first available enumerated camera
              const cameras = await Html5Qrcode.getCameras().catch(() => []);
              if (cameras.length > 0) {
                await scanner.start(
                  cameras[0].id,
                  scanConfig,
                  (decodedText) => {
                    processDecodedFrame(decodedText);
                  },
                  () => {}
                );
              } else {
                // 4. Last resort: empty constraints
                await scanner.start(
                  {},
                  scanConfig,
                  (decodedText) => {
                    processDecodedFrame(decodedText);
                  },
                  () => {}
                );
              }
            }
          }
        }

        if (shouldStopRef.current || isUnmountedRef.current) {
          try {
            await scanner.stop();
            await scanner.clear();
          } catch {}
          scannerRef.current = null;
          setIsCameraActive(false);
        } else {
          setIsCameraActive(true);
        }
      } catch (err) {
        setIsCameraActive(false);
        setCameraError(
          err instanceof Error
            ? err.message
            : "Camera access was denied or is not available. Please allow camera permissions or upload a QR screenshot below."
        );
      } finally {
        isStartingRef.current = false;
        setIsCameraStarting(false);
      }
    },
    [processDecodedFrame, selectedCameraId]
  );

  const stopCamera = useCallback(async () => {
    if (isStartingRef.current) {
      shouldStopRef.current = true;
      return;
    }
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Ignore
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
    setIsCameraStarting(false);
  }, []);

  const handleCameraChange = useCallback(
    async (newCameraId: string) => {
      setSelectedCameraId(newCameraId);
      if (isCameraActive) {
        await stopCamera();
        setTimeout(() => {
          startCamera(newCameraId);
        }, 150);
      }
    },
    [isCameraActive, startCamera, stopCamera]
  );

  // Fallback screenshot/image file scanner
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    try {
      if (scannerRef.current && isCameraActive) {
        await stopCamera();
      }

      const tempScanner = scannerRef.current || new Html5Qrcode(readerElementId);
      scannerRef.current = tempScanner;

      const decodedText = await tempScanner.scanFile(file, true);
      if (decodedText) {
        await processDecodedFrame(decodedText);
      } else {
        setCameraError("No QR code detected in the uploaded image.");
      }
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : "Could not decode a valid QuickSend QR code from this image. Please ensure the QR is clear and well-lit."
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Cleanup camera and created Blob URLs when component unmounts
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      if (isStartingRef.current) {
        shouldStopRef.current = true;
      } else if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      // Revoke created Blob URLs on unmount
      createdBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      createdBlobUrlsRef.current = [];
    };
  }, []);

  const handleDownloadReceived = () => {
    if (!receivedPayload) return;
    const url = URL.createObjectURL(receivedPayload.blob);
    createdBlobUrlsRef.current.push(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = receivedPayload.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          <h3 className="font-bold text-base text-[var(--text)]">Via Camera Scan</h3>
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
              {/* QR Density Preset Selector */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl w-full">
                <div className="text-left w-full sm:w-auto">
                  <div className="text-xs font-bold text-[var(--text)]">QR density</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Smaller is easier to scan, larger is faster
                  </div>
                </div>
                <SegmentedControl
                  value={selectedPreset}
                  onChange={(val) => handlePresetChange(val as OpticalChunkPreset)}
                  options={[
                    { value: "small", label: "Small" },
                    { value: "medium", label: "Medium" },
                    { value: "large", label: "Large" },
                  ]}
                  ariaLabel="QR density"
                />
              </div>

              {/* Large Payload Advisory Banner (> 300 frames) */}
              {frames.length > 300 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">Large Payload Advisory ({frames.length} frames)</p>
                    <p className="text-[11px] opacity-90 leading-relaxed">
                      Optical scanning will take approximately ~{Math.ceil((frames.length * (speedMs / 1000)) / 60)} min. For faster transfer of files over 500 KB, Same Wi-Fi or Internet mode is recommended.
                    </p>
                  </div>
                </div>
              )}

              {/* QR Display Card */}
              <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200">
                  <QRCodeSVG
                    value={frames[currentFrameIndex]?.encodedPayload || ""}
                    size={280}
                    level="L"
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    marginSize={3}
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
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentFrameIndex((prev) => (prev - 1 + frames.length) % frames.length)
                    }
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                    title="Previous Frame"
                    aria-label="Previous Frame"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!hasStartedStreaming) {
                        setHasStartedStreaming(true);
                        setIsPlaying(true);
                      } else {
                        setIsPlaying((prev) => !prev);
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-opacity cursor-pointer"
                  >
                    {!hasStartedStreaming || (currentFrameIndex === 0 && !isPlaying) ? (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" /> Start Stream
                      </>
                    ) : isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" /> Resume
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentFrameIndex((prev) => (prev + 1) % frames.length)}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                    title="Next Frame"
                    aria-label="Next Frame"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentFrameIndex(0);
                      setIsPlaying(false);
                      setHasStartedStreaming(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer"
                    title="Reset to Frame 1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Frame 1</span>
                  </button>

                  <div className="h-4 w-px bg-[var(--border-hairline)] mx-1 hidden sm:block" />

                  {/* Speed Selector */}
                  <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border-hairline)]">
                    <button
                      type="button"
                      onClick={() => setSpeedMs(500)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                        speedMs === 500
                          ? "bg-[var(--text)] text-[var(--surface)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      Slow
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpeedMs(320)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                        speedMs === 320
                          ? "bg-[var(--text)] text-[var(--surface)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpeedMs(220)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
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
                  type="button"
                  onClick={() => {
                    setFrames([]);
                    setCurrentFrameIndex(0);
                    setIsPlaying(false);
                    setHasStartedStreaming(false);
                  }}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors font-medium cursor-pointer"
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
              <div className="relative flex flex-col items-center justify-center p-6 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl min-h-[340px] w-full">
                {/* Always-mounted viewfinder container to prevent zero-dimension crashes */}
                <div
                  id={readerElementId}
                  className="w-full max-w-[320px] min-h-[280px] aspect-square rounded-2xl overflow-hidden bg-black/5 dark:bg-black/30 border border-[var(--border-hairline)] relative"
                >
                  {!isCameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xs z-10 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent)] shadow-2xs">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-[var(--text)]">Point Camera at QR Stream</h4>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-[200px]">
                          Opens camera to continuously scan sequenced QR frames.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        disabled={isCameraStarting}
                        className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-xs transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isCameraStarting ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Starting Camera...
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5" /> Start Camera Scanner
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Live Diagnostics & Camera Controls when Camera is Active */}
                {isCameraActive && (
                  <div className="mt-4 flex flex-col items-center gap-2.5 w-full max-w-sm">
                    <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs shadow-2xs">
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Camera Active
                      </span>

                      {lastDetected && (
                        <>
                          <span className="text-[var(--border-hairline)]">•</span>
                          {lastDetected.isOptical ? (
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md text-[11px]">
                              Frame {lastDetected.frameIndex} of {lastDetected.totalFrames}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md text-[11px]">
                              Unrecognized QR
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {availableCameras.length > 1 && (
                        <select
                          value={selectedCameraId || ""}
                          onChange={(e) => handleCameraChange(e.target.value)}
                          className="text-xs bg-[var(--surface)] text-[var(--text)] border border-[var(--border-hairline)] rounded-xl px-2.5 py-1.5 cursor-pointer shadow-2xs focus:outline-none"
                          aria-label="Switch Camera"
                        >
                          {availableCameras.map((cam) => (
                            <option key={cam.id} value={cam.id}>
                              {cam.label}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-red-500 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                      >
                        Stop Camera
                      </button>
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center max-w-sm">
                    {cameraError}
                  </div>
                )}

                {/* Image Upload Fallback for non-HTTPS or missing camera */}
                <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] w-full max-w-xs text-center space-y-2">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Camera unavailable or local HTTP network?
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="optical-image-fallback-input"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Scan from Screenshot / Image</span>
                  </button>
                </div>
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
                      Received {scanProgress.receivedCount} of {scanProgress.totalChunks} frames ({scanProgress.percentage}%)
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
                    type="button"
                    onClick={handleCopyText}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-xs transition-opacity cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Text"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownloadReceived}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-opacity cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Save file
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] font-medium text-xs hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
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
