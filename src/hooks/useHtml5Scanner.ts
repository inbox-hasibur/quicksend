"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Html5Qrcode, type Html5QrcodeCameraScanConfig } from "html5-qrcode";

let scannerIdCounter = 0;

export interface UseHtml5ScannerReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  start: (
    onDecode: (decodedText: string) => void,
    config?: Html5QrcodeCameraScanConfig,
    cameraId?: string
  ) => Promise<void>;
  stop: () => Promise<void>;
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;
  scanFile: (file: File) => Promise<string>;
  getCameras: () => Promise<Array<{ id: string; label: string }>>;
}

/**
 * Isolated lifecycle manager for Html5Qrcode to prevent DOM reconciliation conflicts with React.
 */
export function useHtml5Scanner(): UseHtml5ScannerReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const childRef = useRef<HTMLDivElement | null>(null);
  const onDecodeRef = useRef<((decodedText: string) => void) | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const shouldStopRef = useRef(false);

  // Safely stop scanner and remove injected DOM node
  const stop = useCallback(async (): Promise<void> => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    shouldStopRef.current = true;

    try {
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        try {
          await scanner.stop();
        } catch {
          // Ignore stop failures if already halted
        }
        try {
          await scanner.clear();
        } catch {
          // Ignore clear failures
        }
      }

      const child = childRef.current;
      childRef.current = null;

      if (child) {
        try {
          if (child.parentNode) {
            child.parentNode.removeChild(child);
          }
        } catch {
          // Ignore DOM detachment errors
        }
      }

      setIsRunning(false);
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  // Initialize and start scanner with isolated DOM child
  const start = useCallback(
    async (
      onDecode: (decodedText: string) => void,
      config?: Html5QrcodeCameraScanConfig,
      cameraId?: string
    ): Promise<void> => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      shouldStopRef.current = false;
      setIsStarting(true);
      setError(null);

      onDecodeRef.current = onDecode;

      // Ensure any running instance is stopped first
      await stop();
      shouldStopRef.current = false;

      const container = containerRef.current;
      if (!container) {
        const msg = "Scanner container element is not available.";
        setError(msg);
        isStartingRef.current = false;
        setIsStarting(false);
        return;
      }

      // Check secure context / mediaDevices support (e.g. non-HTTPS LAN IP)
      if (
        typeof window !== "undefined" &&
        window.isSecureContext === false &&
        !navigator?.mediaDevices &&
        window.location?.hostname &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        const msg =
          "Camera access requires HTTPS or localhost. If opening over local IP, use screenshot or image upload.";
        setError(msg);
        isStartingRef.current = false;
        setIsStarting(false);
        return;
      }

      // Create isolated child div to keep React DOM clean
      const child = document.createElement("div");
      const childId = `html5-scanner-element-${++scannerIdCounter}`;
      child.id = childId;
      child.style.width = "100%";
      child.style.height = "100%";
      container.appendChild(child);
      childRef.current = child;

      try {
        const scanner = new Html5Qrcode(childId);
        scannerRef.current = scanner;

        const scanConfig: Html5QrcodeCameraScanConfig = config || {
          fps: 15,
          disableFlip: true,
          videoConstraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const successCallback = (decodedText: string) => {
          try {
            if (onDecodeRef.current) {
              onDecodeRef.current(decodedText);
            }
          } catch (callbackErr) {
            console.error("Scanner decode callback error:", callbackErr);
          }
        };

        if (cameraId) {
          await scanner.start(cameraId, scanConfig, successCallback, () => {});
        } else {
          // Fallback sequence: environment -> user -> first available camera -> empty constraints
          try {
            await scanner.start(
              { facingMode: "environment" },
              scanConfig,
              successCallback,
              () => {}
            );
          } catch {
            try {
              await scanner.start(
                { facingMode: "user" },
                scanConfig,
                successCallback,
                () => {}
              );
            } catch {
              const cameras = await Html5Qrcode.getCameras().catch(() => []);
              if (cameras.length > 0) {
                await scanner.start(
                  cameras[0].id,
                  scanConfig,
                  successCallback,
                  () => {}
                );
              } else {
                await scanner.start(
                  {},
                  scanConfig,
                  successCallback,
                  () => {}
                );
              }
            }
          }
        }

        if (shouldStopRef.current || isUnmountedRef.current) {
          await stop();
        } else {
          setIsRunning(true);
        }
      } catch (err) {
        setIsRunning(false);
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Camera access was denied or is not available.";
        setError(errorMsg);

        if (child.parentNode) {
          try {
            child.parentNode.removeChild(child);
          } catch {
            // Ignore
          }
        }
        childRef.current = null;
        scannerRef.current = null;
      } finally {
        isStartingRef.current = false;
        setIsStarting(false);
      }
    },
    [stop]
  );

  // Scan QR code from an uploaded image file without affecting live container
  const scanFile = useCallback(async (file: File): Promise<string> => {
    const tempDiv = document.createElement("div");
    const tempId = `html5-temp-file-${++scannerIdCounter}`;
    tempDiv.id = tempId;
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);

    try {
      const fileScanner = new Html5Qrcode(tempId);
      const decoded = await fileScanner.scanFile(file, true);
      try {
        await fileScanner.clear();
      } catch {
        // Ignore
      }
      return decoded;
    } finally {
      if (tempDiv.parentNode) {
        try {
          tempDiv.parentNode.removeChild(tempDiv);
        } catch {
          // Ignore
        }
      }
    }
  }, []);

  // Enumerate cameras
  const getCameras = useCallback(async () => {
    try {
      const cameras = await Html5Qrcode.getCameras();
      return (cameras || []).map((c, i) => ({
        id: c.id,
        label: c.label || `Camera ${i + 1}`,
      }));
    } catch {
      return [];
    }
  }, []);

  // Cleanup on unmount
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
    isStarting,
    error,
    scanFile,
    getCameras,
  };
}
