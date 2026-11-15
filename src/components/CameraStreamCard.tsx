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
import { useHtml5Scanner } from "@/hooks/useHtml5Scanner";
import { useQuadScanner } from "@/hooks/useQuadScanner";
import { Dropzone } from "@/components/Dropzone";
import { SegmentedControl } from "@/components/SegmentedControl";
import { EstimateBadge } from "@/components/EstimateBadge";
import {
  encodeFileToOpticalFrames,
  encodeTextToOpticalFrames,
  buildParityFrames,
  OpticalDataCollector,
  OPTICAL_CHUNK_PRESETS,
  type OpticalChunkPreset,
  type OpticalDataFrame,
  type ReassembledPayload,
} from "@/lib/opticalDataStream";
import { encodeRecoveryCode, decodeRecoveryCode } from "@/lib/opticalRecovery";
import { useTransferHistory } from "@/hooks/useTransferHistory";
import { formatBytes } from "@/lib/chunker";

type OpticalRole = "send" | "receive";
export type CameraLayout = "single" | "2x2" | "3x2";

export function getFramesPerTick(layout: CameraLayout): number {
  if (layout === "3x2") return 6;
  if (layout === "2x2") return 4;
  return 1;
}

export function CameraStreamCard() {
  const [role, setRole] = useState<OpticalRole>("send");

  // Sender state (Starts paused on Frame 1 with default 3x2 and Large density)
  const [frames, setFrames] = useState<OpticalDataFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(320); // 320ms normal speed
  const [isEncoding, setIsEncoding] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<OpticalChunkPreset>("large");
  const [activePayload, setActivePayload] = useState<{ files: File[]; text: string } | null>(null);
  const [senderLayout, setSenderLayout] = useState<CameraLayout>("3x2");

  // Sender recovery replay state
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [replayIndices, setReplayIndices] = useState<number[] | null>(null);

  // Receiver scanner state
  const [scannerType, setScannerType] = useState<"auto" | "classic">("auto");
  const html5Scanner = useHtml5Scanner();
  const quadScanner = useQuadScanner();

  const isCameraActive =
    scannerType === "auto" ? quadScanner.isRunning : html5Scanner.isRunning;
  const isCameraStarting =
    scannerType === "auto" ? false : html5Scanner.isStarting;
  const scannerError =
    scannerType === "auto" ? quadScanner.error : html5Scanner.error;

  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryCodeCopied, setRecoveryCodeCopied] = useState(false);
  const [sessionHash, setSessionHash] = useState<string | null>(null);

  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const completedRef = useRef(false);
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

  // Diagnostic line tracking: Decoded | Valid | Invalid | Last
  const diagnosticsRef = useRef({
    decoded: 0,
    valid: 0,
    invalid: 0,
    last: "none",
  });
  const [diagnostics, setDiagnostics] = useState({
    decoded: 0,
    valid: 0,
    invalid: 0,
    last: "none",
  });
  const lastDiagFlushRef = useRef<number>(0);
  const diagTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flushDiagnostics = useCallback(() => {
    const now = Date.now();
    if (now - lastDiagFlushRef.current >= 250) {
      lastDiagFlushRef.current = now;
      setDiagnostics({ ...diagnosticsRef.current });
    } else if (!diagTimerRef.current) {
      diagTimerRef.current = setTimeout(() => {
        diagTimerRef.current = null;
        lastDiagFlushRef.current = Date.now();
        setDiagnostics({ ...diagnosticsRef.current });
      }, 250 - (now - lastDiagFlushRef.current));
    }
  }, []);

  const { addHistoryItem } = useTransferHistory();
  const collectorRef = useRef<OpticalDataCollector>(new OpticalDataCollector());
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

  // Re-encode payload with given chunk preset and parity frames
  const encodePayload = useCallback(
    async (payload: { files: File[]; text: string }, preset: OpticalChunkPreset) => {
      setIsEncoding(true);
      try {
        let dataFrames: OpticalDataFrame[] = [];
        const chunkSize = OPTICAL_CHUNK_PRESETS[preset];
        if (payload.files.length > 0) {
          dataFrames = await encodeFileToOpticalFrames(payload.files[0], chunkSize);
        } else if (payload.text.trim()) {
          dataFrames = await encodeTextToOpticalFrames(payload.text.trim(), chunkSize);
        }
        const parityFrames = buildParityFrames(dataFrames, chunkSize);
        const allFrames = [...dataFrames, ...parityFrames];
        setFrames(allFrames);
        setCurrentFrameIndex(0);
        setIsPlaying(false);
        setHasStartedStreaming(false);
        setReplayIndices(null);
        setRecoveryInput("");
        setRecoveryError(null);
      } catch (err) {
        console.error("Failed to encode payload to optical frames:", err);
      } finally {
        setIsEncoding(false);
      }
    },
    []
  );

  // Active frames displayed: full stream or replayed missing subset
  const displayedFrames =
    replayIndices !== null
      ? frames.filter((f) => !f.isParity && replayIndices.includes(f.chunkIndex))
      : frames;
  const activeFramesList = displayedFrames.length > 0 ? displayedFrames : frames;

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
    const perTick = getFramesPerTick(senderLayout);
    const totalSteps = Math.ceil(activeFramesList.length / perTick);

    if (role !== "send" || totalSteps <= 1 || !isPlaying) {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      return;
    }

    playbackTimerRef.current = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        if (perTick > 1) {
          const currentTick = Math.floor(prev / perTick);
          const nextTick = (currentTick + 1) % totalSteps;
          return nextTick * perTick;
        }
        return (prev + 1) % totalSteps;
      });
    }, speedMs);

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [role, activeFramesList.length, isPlaying, speedMs, senderLayout]);

  const stopCamera = useCallback(async () => {
    if (scannerType === "auto") {
      await quadScanner.stop();
    } else {
      await html5Scanner.stop();
    }
  }, [html5Scanner, quadScanner, scannerType]);

  // Reusable frame processor for camera frames
  const processDecodedFrame = useCallback(
    async (decodedText: string) => {
      // Early exit if collection already completed
      if (completedRef.current) return;

      // Wrap entire success callback in try/catch to avoid crashes
      try {
        const now = Date.now();
        diagnosticsRef.current.decoded++;

        // Ignore identical frame text if received within 100ms
        if (
          decodedText === lastScannedTextRef.current &&
          now - lastScannedTimeRef.current < 100
        ) {
          flushDiagnostics();
          return;
        }
        lastScannedTextRef.current = decodedText;
        lastScannedTimeRef.current = now;

        // Ingest frame into collector ref directly
        const res = await collectorRef.current.add(decodedText);

        const currentHash = collectorRef.current.getSessionHash();
        if (currentHash) {
          setSessionHash(currentHash);
        }

        if (res.status === "invalid") {
          diagnosticsRef.current.invalid++;
          diagnosticsRef.current.last = "invalid";
          flushDiagnostics();
          setLastDetected({ isOptical: false, timestamp: now });
          return;
        }

        if (res.status === "error") {
          diagnosticsRef.current.invalid++;
          diagnosticsRef.current.last = "error";
          flushDiagnostics();
          setCameraError(res.error);
          return;
        }

        if (res.status === "collecting") {
          diagnosticsRef.current.valid++;
          diagnosticsRef.current.last = `Frame ${res.receivedCount} of ${res.totalChunks}`;
          flushDiagnostics();
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
          diagnosticsRef.current.valid++;
          diagnosticsRef.current.last = `complete (${res.payload.fileName})`;
          flushDiagnostics();

          if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
          }

          // First mark completed so callback ignores any further frames
          completedRef.current = true;

          // Await scanner stop before updating finished UI state
          await stopCamera();

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
    [addHistoryItem, flushDiagnostics, stopCamera]
  );

  // Handle receiver camera initialization and scanning
  const startCamera = useCallback(
    async (overrideCameraId?: string) => {
      setCameraError(null);
      setReceivedPayload(null);
      setScanProgress(null);
      setLastDetected(null);
      setSessionHash(null);
      completedRef.current = false;
      collectorRef.current.reset();
      lastScannedTextRef.current = "";
      lastScannedTimeRef.current = 0;
      diagnosticsRef.current = { decoded: 0, valid: 0, invalid: 0, last: "none" };
      setDiagnostics({ decoded: 0, valid: 0, invalid: 0, last: "none" });

      if (scannerType === "auto") {
        await quadScanner.start((decodedText) => {
          processDecodedFrame(decodedText);
        });
      } else {
        // Populate camera list
        try {
          const cameras = await html5Scanner.getCameras();
          if (cameras.length > 0) {
            setAvailableCameras(cameras);
          }
        } catch {
          // Ignore enumeration errors
        }

        const targetCamera = overrideCameraId || selectedCameraId || undefined;
        await html5Scanner.start(
          (decodedText) => {
            processDecodedFrame(decodedText);
          },
          undefined,
          targetCamera
        );
      }
    },
    [
      html5Scanner,
      processDecodedFrame,
      quadScanner,
      scannerType,
      selectedCameraId,
    ]
  );

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

  const handleScannerTypeChange = async (newType: "auto" | "classic") => {
    if (isCameraActive) {
      await stopCamera();
    }
    setScannerType(newType);
  };

  const handleApplyRecoveryCode = () => {
    if (!recoveryInput.trim()) {
      setRecoveryError("Please enter a recovery code.");
      return;
    }
    const sessionHash = frames[0]?.hash || "";
    const decoded = decodeRecoveryCode(recoveryInput.trim(), sessionHash);
    if (!decoded.ok) {
      if (decoded.reason === "word") {
        setRecoveryError("A word is not recognized.");
      } else if (decoded.reason === "session") {
        setRecoveryError("Recovery code is from a different transfer session.");
      } else if (decoded.reason === "checksum") {
        setRecoveryError("Recovery code checksum mismatch. Please recheck typing.");
      } else {
        setRecoveryError("Invalid recovery code format.");
      }
      return;
    }

    const validIndices = decoded.indices || [];
    const matching = frames.filter(
      (f) => !f.isParity && validIndices.includes(f.chunkIndex)
    );
    if (matching.length === 0) {
      setRecoveryError("No matching frames found for this code.");
      return;
    }

    setRecoveryError(null);
    setReplayIndices(validIndices);
    setCurrentFrameIndex(0);
    setIsPlaying(true);
    setHasStartedStreaming(true);
  };

  // Cleanup timers and created Blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      if (diagTimerRef.current) {
        clearTimeout(diagTimerRef.current);
        diagTimerRef.current = null;
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
    <div className="space-y-6" translate="no">
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
            diagnosticsRef.current = { decoded: 0, valid: 0, invalid: 0, last: "none" };
            setDiagnostics({ decoded: 0, valid: 0, invalid: 0, last: "none" });
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
              {/* QR Density and Layout Selector */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl w-full">
                <div className="text-left w-full sm:w-auto">
                  <div className="text-xs font-bold text-[var(--text)]">QR Density &amp; Layout</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Smaller is easier to scan, larger is faster
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    value={senderLayout}
                    onChange={(val) => {
                      setSenderLayout(val as CameraLayout);
                      setCurrentFrameIndex(0);
                    }}
                    options={[
                      { value: "single", label: "Single" },
                      { value: "2x2", label: "2x2" },
                      { value: "3x2", label: "3x2" },
                    ]}
                    ariaLabel="Sender QR layout"
                  />
                  <SegmentedControl
                    value={selectedPreset}
                    onChange={(val) => {
                      handlePresetChange(val as OpticalChunkPreset);
                    }}
                    options={[
                      { value: "small", label: "Small" },
                      { value: "medium", label: "Medium" },
                      { value: "large", label: "Large" },
                    ]}
                    ariaLabel="QR density"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] text-center w-full">
                Hard to scan? Use 2x2 or Medium density.
              </p>

              {/* QR Display Card */}
              <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl">
                {(() => {
                  const perTick = getFramesPerTick(senderLayout);
                  const tick = Math.floor(currentFrameIndex / perTick);
                  const maxWidthClass =
                    senderLayout === "3x2"
                      ? "max-w-[720px]"
                      : senderLayout === "2x2"
                      ? "max-w-[420px]"
                      : "max-w-[360px]";
                  const gridColsClass =
                    senderLayout === "3x2"
                      ? "grid-cols-3"
                      : senderLayout === "2x2"
                      ? "grid-cols-2"
                      : "grid-cols-1";

                  const tickFrames = Array.from(
                    { length: perTick },
                    (_, i) => activeFramesList[tick * perTick + i] || null
                  );

                  return (
                    <div
                      className={`w-full ${maxWidthClass} mx-auto p-1 rounded-xl bg-white shadow-sm border border-neutral-200`}
                    >
                      <div className={`grid gap-[2px] ${gridColsClass}`}>
                        {tickFrames.map((frame, idx) => (
                          <div
                            key={idx}
                            className="w-full bg-white flex items-center justify-center overflow-hidden"
                          >
                            {frame ? (
                              <QRCodeSVG
                                value={frame.encodedPayload}
                                size={256}
                                level="L"
                                marginSize={2}
                                shapeRendering="crispEdges"
                                style={{ width: "100%", height: "auto" }}
                              />
                            ) : (
                              <div className="w-full aspect-square bg-white" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Frame Counter & Progress Bar */}
                <div className="w-full max-w-sm mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text)] truncate max-w-[200px]">
                      {frames[0]?.fileName}
                    </span>
                    <span className="font-mono tabular-nums text-[11px]">
                      {(() => {
                        const perTick = getFramesPerTick(senderLayout);
                        const prefix = replayIndices !== null ? "Replay" : "Frames";
                        if (perTick === 1) {
                          return `${prefix} ${currentFrameIndex + 1} of ${activeFramesList.length}`;
                        }
                        const tick = Math.floor(currentFrameIndex / perTick);
                        const start = tick * perTick + 1;
                        const end = Math.min(tick * perTick + perTick, activeFramesList.length);
                        return start === end
                          ? `${prefix} ${start} of ${activeFramesList.length}`
                          : `${prefix} ${start} to ${end} of ${activeFramesList.length}`;
                      })()}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <EstimateBadge
                      channel="camera"
                      totalBytes={frames[0]?.fileSize || 1}
                      frames={frames.length}
                      frameIntervalMs={speedMs}
                      framesPerTick={getFramesPerTick(senderLayout)}
                    />
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-150"
                      style={{
                        width: `${
                          (Math.min(
                            currentFrameIndex + getFramesPerTick(senderLayout),
                            activeFramesList.length
                          ) /
                            activeFramesList.length) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Playback & Speed Controls */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      const perTick = getFramesPerTick(senderLayout);
                      const totalTicks = Math.ceil(activeFramesList.length / perTick);
                      const curTick = Math.floor(currentFrameIndex / perTick);
                      const prevTick = (curTick - 1 + totalTicks) % totalTicks;
                      setCurrentFrameIndex(prevTick * perTick);
                    }}
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
                    onClick={() => {
                      const perTick = getFramesPerTick(senderLayout);
                      const totalTicks = Math.ceil(activeFramesList.length / perTick);
                      const curTick = Math.floor(currentFrameIndex / perTick);
                      const nextTick = (curTick + 1) % totalTicks;
                      setCurrentFrameIndex(nextTick * perTick);
                    }}
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

                {/* Collapsible Replay Missing Frames Section */}
                <div className="w-full max-w-sm mt-4 pt-3 border-t border-[var(--border-hairline)]">
                  <button
                    type="button"
                    onClick={() => setIsReplayOpen((prev) => !prev)}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center justify-between w-full cursor-pointer"
                  >
                    <span>Replay missing frames</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      {isReplayOpen ? "Hide ▲" : "Show ▼"}
                    </span>
                  </button>

                  {isReplayOpen && (
                    <div className="mt-2.5 space-y-2">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Enter the recovery code from the receiver to loop only frames lost to camera shake.
                      </p>
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={recoveryInput}
                          onChange={(e) => {
                            setRecoveryInput(e.target.value);
                            setRecoveryError(null);
                          }}
                          placeholder="Type or paste the words, for example: tiger river lamp ..."
                          className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-xs text-[var(--text)] focus:outline-none resize-none leading-relaxed"
                        />
                        <div className="flex items-center justify-between">
                          {recoveryError ? (
                            <p className="text-[11px] text-red-500">{recoveryError}</p>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={handleApplyRecoveryCode}
                            className="px-3 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer ml-auto"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {replayIndices !== null && (
                    <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        Replaying {replayIndices.length} missing frames
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setReplayIndices(null);
                          setCurrentFrameIndex(0);
                          setRecoveryInput("");
                        }}
                        className="text-[11px] font-semibold text-[var(--text)] hover:underline cursor-pointer"
                      >
                        Back to full stream
                      </button>
                    </div>
                  )}
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
              {/* Receiver Scanner Toggle */}
              <div className="flex items-center justify-between max-w-md mx-auto w-full">
                <span className="text-xs font-semibold text-[var(--text)]">Scanner</span>
                <SegmentedControl
                  value={scannerType}
                  onChange={(val) => handleScannerTypeChange(val as "auto" | "classic")}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "classic", label: "Classic" },
                  ]}
                  ariaLabel="Receiver scanner mode"
                />
              </div>

              {/* Preview first and large */}
              <div className="relative w-full max-w-md mx-auto aspect-[3/4] sm:aspect-square">
                {/* Scanner container: always laid out, never display:none */}
                <div
                  ref={scannerType === "auto" ? quadScanner.containerRef : html5Scanner.containerRef}
                  className={`relative w-full max-w-md mx-auto aspect-[3/4] sm:aspect-square overflow-hidden rounded-2xl bg-black qs-scanner transition-opacity ${
                    !isCameraActive ? "opacity-0 pointer-events-none" : "opacity-100"
                  }`}
                />

                {/* Sibling overlay when camera is inactive */}
                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xs rounded-2xl border border-[var(--border-hairline)] z-10 space-y-3">
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

              {/* Camera Active pill */}
              {isCameraActive && (
                <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
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

                  {/* Camera dropdown and Stop Camera button */}
                  <div className="flex items-center gap-2">
                    {availableCameras.length > 1 && scannerType === "classic" && (
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

              {/* Diagnostic line: Decoded 0 | Valid 0 | Invalid 0 | Layout 3x2 | Last: none */}
              <div className="font-mono text-[11px] text-[var(--text-muted)] text-center">
                Decoded {diagnostics.decoded} | Valid {diagnostics.valid} | Invalid {diagnostics.invalid} | Layout {scannerType === "auto" ? quadScanner.detectedLayout : "1x1"} | Last: {diagnostics.last}
              </div>

              {(cameraError || scannerError) && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center max-w-md mx-auto w-full">
                  {scannerError || cameraError}
                </div>
              )}

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

                  {/* Missing frames recovery code */}
                  {scanProgress.totalChunks > 0 && scanProgress.missingIndices.length > 0 && (
                    <div className="pt-2 flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => setShowRecoveryCode((prev) => !prev)}
                        className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        {showRecoveryCode ? "Hide missing frames code" : "Missing frames code"}
                      </button>

                      {showRecoveryCode && (
                        <div className="mt-2.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] w-full text-left space-y-2">
                          {(() => {
                            const missing = scanProgress.missingIndices;
                            if (!sessionHash) {
                              return (
                                <p className="text-xs text-[var(--text-muted)]">
                                  Waiting for stream session hash...
                                </p>
                              );
                            }
                            const code = encodeRecoveryCode(sessionHash, missing);
                            if (!code) {
                              return (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                  Too many missing. Keep scanning.
                                </p>
                              );
                            }
                            return (
                              <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] space-y-2">
                                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                                  <span>Missing {missing.length} frames</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(code);
                                        setRecoveryCodeCopied(true);
                                        setTimeout(() => setRecoveryCodeCopied(false), 2000);
                                      } catch {}
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
                                  >
                                    {recoveryCodeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {recoveryCodeCopied ? "Copied" : "Copy"}
                                  </button>
                                </div>
                                <p className="text-base text-[var(--text)] font-sans leading-relaxed break-words select-all">
                                  {code}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
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
