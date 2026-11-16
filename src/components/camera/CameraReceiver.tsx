"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera } from "lucide-react";
import { useHtml5Scanner } from "@/hooks/useHtml5Scanner";
import { useQuadScanner } from "@/hooks/useQuadScanner";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  OpticalDataCollector,
  type ReassembledPayload,
} from "@/lib/opticalDataStream";
import { useTransferHistory } from "@/hooks/useTransferHistory";
import { ReceiverProgressView } from "@/components/camera/ReceiverProgressView";
import { ReceiverCompleteView } from "@/components/camera/ReceiverCompleteView";

export interface CameraReceiverProps {
  defaultScannerType?: "auto" | "classic";
  className?: string;
}

export function CameraReceiver({
  defaultScannerType = "auto",
  className = "",
}: CameraReceiverProps) {
  // Receiver scanner state
  const [scannerType, setScannerType] = useState<"auto" | "classic">(defaultScannerType);
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

            // Trigger safe automated download for files
            if (!res.payload.text) {
              try {
                const url = URL.createObjectURL(res.payload.blob);
                createdBlobUrlsRef.current.push(url);
                const a = document.createElement("a");
                a.href = url;
                a.download = res.payload.fileName || "downloaded-file";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              } catch (dlErr) {
                console.debug("Auto download trigger error:", dlErr);
              }
            }
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

  const isCameraActiveRef = useRef(isCameraActive);
  const stopCameraRef = useRef(stopCamera);

  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
    stopCameraRef.current = stopCamera;
  }, [isCameraActive, stopCamera]);

  // Cleanup timers, camera, and created Blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (isCameraActiveRef.current && !completedRef.current) {
        stopCameraRef.current();
      }
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
    <div className={`space-y-6 ${className}`}>
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
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[var(--surface-glass)] backdrop-blur-2xs rounded-2xl border border-[var(--border-hairline)] z-10 space-y-3">
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
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs shadow-xs transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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

          {/* Diagnostic line: Decoded 0 | Valid 0 | Invalid 0 | Layout 2x2 | Last: none */}
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
            <ReceiverProgressView
              scanProgress={scanProgress}
              sessionHash={sessionHash}
              showRecoveryCode={showRecoveryCode}
              recoveryCodeCopied={recoveryCodeCopied}
              onToggleRecoveryCode={() => setShowRecoveryCode((prev) => !prev)}
              onCopyRecoveryCode={async (code) => {
                try {
                  await navigator.clipboard.writeText(code);
                  setRecoveryCodeCopied(true);
                  setTimeout(() => setRecoveryCodeCopied(false), 2000);
                } catch {}
              }}
            />
          )}
        </div>
      ) : (
        <ReceiverCompleteView
          payload={receivedPayload}
          copied={copied}
          onCopyText={handleCopyText}
          onDownload={handleDownloadReceived}
          onScanAnother={() => startCamera()}
        />
      )}
    </div>
  );
}

export default CameraReceiver;
