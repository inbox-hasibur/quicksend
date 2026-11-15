"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { decodeGrid, jsqrDecodeOne } from "@/lib/quadDecode";

export type LayoutCandidate = "1x1" | "2x2" | "2x3";
export const LAYOUT_CANDIDATES: LayoutCandidate[] = ["1x1", "2x2", "2x3"];

/**
 * Pure helper to pick decoding layout based on miss streaks.
 * Rotates through other candidate layouts when missStreak >= 5.
 */
export function pickLayout(
  lastGood: LayoutCandidate,
  missStreak: number,
  rotateIndex: number
): LayoutCandidate {
  if (missStreak < 5) return lastGood;
  const others = LAYOUT_CANDIDATES.filter((c) => c !== lastGood);
  return others[Math.abs(rotateIndex) % others.length];
}

export interface UseQuadScannerReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  start: (onDecode: (decodedText: string) => void) => Promise<void>;
  stop: () => Promise<void>;
  isRunning: boolean;
  error: string | null;
  detectedLayout: string;
}

interface BarcodeResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect: (source: CanvasImageSource) => Promise<BarcodeResult[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorInstance;
  }
}

/**
 * Custom 2x2 multi-quadrant camera scanner hook.
 * Captures video via getUserMedia, runs 10fps loop, and decodes 4 quadrants with
 * native BarcodeDetector or jsQR quadrant splitting.
 */
export function useQuadScanner(): UseQuadScannerReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const onDecodeRef = useRef<((decodedText: string) => void) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedLayout, setDetectedLayout] = useState<string>("1x1");

  const lastGoodRef = useRef<LayoutCandidate>("1x1");
  const missStreakRef = useRef(0);
  const rotateIndexRef = useRef(0);

  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const shouldStopRef = useRef(false);

  // Safely stop stream, cancel loop, and remove video element
  const stop = useCallback(async (): Promise<void> => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    shouldStopRef.current = true;

    try {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const stream = streamRef.current;
      streamRef.current = null;
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore track close error
          }
        });
      }

      const video = videoRef.current;
      videoRef.current = null;
      if (video) {
        try {
          video.pause();
          video.srcObject = null;
        } catch {
          // Ignore pause error
        }
        if (video.parentNode) {
          try {
            video.parentNode.removeChild(video);
          } catch {
            // Ignore DOM detach error
          }
        }
      }

      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }

      setIsRunning(false);
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  const start = useCallback(
    async (onDecode: (decodedText: string) => void): Promise<void> => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      shouldStopRef.current = false;
      setError(null);
      onDecodeRef.current = onDecode;
      lastGoodRef.current = "1x1";
      missStreakRef.current = 0;
      rotateIndexRef.current = 0;
      setDetectedLayout("1x1");

      // Ensure any previous session is halted
      await stop();
      shouldStopRef.current = false;

      const container = containerRef.current;
      if (!container) {
        setError("Scanner container element is not available.");
        isStartingRef.current = false;
        return;
      }

      // Check camera access support
      if (typeof window !== "undefined" && !navigator?.mediaDevices?.getUserMedia) {
        setError("Camera needs HTTPS. Open the https site.");
        isStartingRef.current = false;
        return;
      }

      // Settle layout with 2 requestAnimationFrame ticks
      const raf =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (cb: FrameRequestCallback) => setTimeout(cb, 16);

      await new Promise<void>((resolve) => {
        raf(() => {
          raf(() => resolve());
        });
      });

      if (shouldStopRef.current || isUnmountedRef.current) {
        isStartingRef.current = false;
        return;
      }

      // Request media stream with fallback sequence: environment -> user -> general
      let mediaStream: MediaStream | null = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "user" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Camera access was denied or unavailable.";
            setError(msg);
            isStartingRef.current = false;
            return;
          }
        }
      }

      if (shouldStopRef.current || isUnmountedRef.current) {
        mediaStream?.getTracks().forEach((t) => t.stop());
        isStartingRef.current = false;
        return;
      }

      streamRef.current = mediaStream;

      // Imperatively create isolated video element
      const video = document.createElement("video");
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      video.className = "w-full h-full object-cover";
      container.appendChild(video);
      videoRef.current = video;

      try {
        video.srcObject = mediaStream;
        await video.play().catch(() => {});
      } catch {
        // Ignore autoplay policy rejection
      }

      // Wait for video to begin playing or up to 3 seconds
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && !video.paused) {
          resolve();
          return;
        }

        let done = false;
        const onDone = () => {
          if (!done) {
            done = true;
            video.removeEventListener("playing", onDone);
            clearTimeout(timer);
            resolve();
          }
        };

        const timer = setTimeout(onDone, 3000);
        video.addEventListener("playing", onDone, { once: true });
      });

      if (shouldStopRef.current || isUnmountedRef.current) {
        await stop();
        isStartingRef.current = false;
        return;
      }

      if (!canvasRef.current && typeof document !== "undefined") {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current || document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      let barcodeDetector: BarcodeDetectorInstance | null = null;
      if (typeof window !== "undefined" && window.BarcodeDetector) {
        try {
          barcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          barcodeDetector = null;
        }
      }

      let lastScanTime = 0;
      let isProcessing = false;

      const loop = async () => {
        if (shouldStopRef.current || isUnmountedRef.current) return;

        const now = Date.now();
        // Limit to max 10 decodes per second (100ms interval)
        if (now - lastScanTime >= 100 && !isProcessing) {
          lastScanTime = now;

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            isProcessing = true;
            try {
              // Cap maximum decode dimensions to 720px to prevent mobile memory spikes and tab crashes
              const maxDim = 720;
              let targetW = video.videoWidth;
              let targetH = video.videoHeight;
              if (targetW > maxDim || targetH > maxDim) {
                if (targetW >= targetH) {
                  targetH = Math.round((targetH * maxDim) / targetW);
                  targetW = maxDim;
                } else {
                  targetW = Math.round((targetW * maxDim) / targetH);
                  targetH = maxDim;
                }
              }

              if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW;
                canvas.height = targetH;
              }

              ctx?.drawImage(video, 0, 0, targetW, targetH);

              let decodedStrings: string[] = [];

              if (barcodeDetector) {
                try {
                  const barcodes = await barcodeDetector.detect(canvas);
                  decodedStrings = barcodes.map((b) => b.rawValue).filter(Boolean);
                } catch {
                  decodedStrings = [];
                }
              }

              const activeCandidate = pickLayout(
                lastGoodRef.current,
                missStreakRef.current,
                rotateIndexRef.current
              );
              if (missStreakRef.current >= 5) {
                rotateIndexRef.current++;
              }

              // Fallback to auto-grid jsQR decode if BarcodeDetector found nothing
              if (decodedStrings.length === 0 && ctx) {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const [cStr, rStr] =
                  activeCandidate === "1x1" ? ["1", "1"] : activeCandidate.split("x");
                const cols = parseInt(cStr, 10) || 1;
                const rows = parseInt(rStr, 10) || 1;
                decodedStrings = decodeGrid(imgData, cols, rows, jsqrDecodeOne);
              }

              if (decodedStrings.length > 0) {
                lastGoodRef.current = activeCandidate;
                missStreakRef.current = 0;
                setDetectedLayout(activeCandidate);
              } else {
                missStreakRef.current++;
              }

              for (const text of decodedStrings) {
                try {
                  onDecodeRef.current?.(text);
                } catch (cbErr) {
                  console.error("useQuadScanner decode error:", cbErr);
                }
              }
            } catch {
              // Ignore frame capture error
            } finally {
              isProcessing = false;
            }
          }
        }

        if (!shouldStopRef.current && !isUnmountedRef.current) {
          animFrameRef.current = requestAnimationFrame(loop);
        }
      };

      animFrameRef.current = requestAnimationFrame(loop);
      setIsRunning(true);
      isStartingRef.current = false;
    },
    [stop]
  );

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      shouldStopRef.current = true;
      stop().catch(() => {});
      canvasRef.current = null;
    };
  }, [stop]);

  return {
    containerRef,
    start,
    stop,
    isRunning,
    error,
    detectedLayout,
  };
}
