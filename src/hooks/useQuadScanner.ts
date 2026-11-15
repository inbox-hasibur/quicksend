"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { decodeGrid, jsqrDecodeOne } from "@/lib/quadDecode";

export interface UseQuadScannerReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  start: (
    onDecode: (decodedText: string) => void,
    scanOptions?: { cols?: number; rows?: number }
  ) => Promise<void>;
  stop: () => Promise<void>;
  isRunning: boolean;
  error: string | null;
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

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const shouldStopRef = useRef(false);
  const gridShapeRef = useRef<{ cols: number; rows: number }>({ cols: 3, rows: 2 });

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

      setIsRunning(false);
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  const start = useCallback(
    async (
      onDecode: (decodedText: string) => void,
      scanOptions?: { cols?: number; rows?: number }
    ): Promise<void> => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      shouldStopRef.current = false;
      setError(null);
      onDecodeRef.current = onDecode;

      if (scanOptions?.cols) gridShapeRef.current.cols = scanOptions.cols;
      if (scanOptions?.rows) gridShapeRef.current.rows = scanOptions.rows;

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

      const canvas = document.createElement("canvas");
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
              if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
              }

              ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

              let decodedStrings: string[] = [];

              if (barcodeDetector) {
                try {
                  const barcodes = await barcodeDetector.detect(canvas);
                  decodedStrings = barcodes.map((b) => b.rawValue).filter(Boolean);
                } catch {
                  decodedStrings = [];
                }
              }

              // Fallback to multi-region jsQR decode if BarcodeDetector found nothing
              if (decodedStrings.length === 0 && ctx) {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                decodedStrings = decodeGrid(
                  imgData,
                  jsqrDecodeOne,
                  gridShapeRef.current.cols,
                  gridShapeRef.current.rows
                );
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
    };
  }, [stop]);

  return {
    containerRef,
    start,
    stop,
    isRunning,
    error,
  };
}
