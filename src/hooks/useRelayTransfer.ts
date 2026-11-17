"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  generateRelayCode,
  normalizeRelayCode,
  generateSalt,
  deriveRelayKey,
  encryptBytes,
  decryptBytes,
  encryptText,
  decryptText,
} from "@/lib/relayCrypto";
import { upload } from "@vercel/blob/client";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import { normalizeRoomCode } from "@/lib/codeGenerator";

export type RelayState = "idle" | "encrypting" | "uploading" | "ready" | "error";

export interface RelayStatus {
  available: boolean;
  maxFileBytes: number;
  maxFiles: number;
  ttlMinutes: number;
}

export interface RelayItemMetadata {
  url: string;
  pathname: string;
  name: string;
  size: number;
  mimeType: string;
  iv: string;
}

export interface RelayPayloadData {
  salt: string;
  createdAt: number;
  items: RelayItemMetadata[];
  text?: {
    cipherText: string;
    iv: string;
  };
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useRelayTransfer() {
  const [relayStatus, setRelayStatus] = useState<RelayStatus | null>(null);
  const [relayState, setRelayState] = useState<RelayState>("idle");
  const [progress, setProgress] = useState(0);
  const [relayCode, setRelayCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relayPayload, setRelayPayload] = useState<RelayPayloadData | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const activeRoomCodeRef = useRef<string | null>(null);

  // Fetch /api/relay/status on mount
  useEffect(() => {
    let mounted = true;
    fetch("/api/relay/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RelayStatus | null) => {
        if (mounted && data) {
          setRelayStatus(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setRelayStatus({ available: false, maxFileBytes: 52428800, maxFiles: 5, ttlMinutes: 15 });
        }
      });

    return () => {
      mounted = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // SENDER: Upload encrypted payload to temporary cloud relay
  const startRelayUpload = useCallback(
    async (roomCode: string, files: File[], text?: string) => {
      if (!relayStatus?.available) {
        setError("Encrypted cloud relay is not available.");
        setRelayState("error");
        return;
      }

      if (files.length > relayStatus.maxFiles) {
        setError(`Cannot send more than ${relayStatus.maxFiles} files via relay.`);
        setRelayState("error");
        return;
      }

      for (const file of files) {
        if (file.size > relayStatus.maxFileBytes) {
          setError(`File "${file.name}" exceeds the 50MB relay limit.`);
          setRelayState("error");
          return;
        }
      }

      if (files.length === 0 && (!text || !text.trim())) {
        return;
      }

      try {
        setError(null);
        setRelayState("encrypting");
        setProgress(5);
        activeRoomCodeRef.current = roomCode;

        const generatedCode = generateRelayCode();
        const salt = generateSalt();
        const key = await deriveRelayKey(generatedCode, salt);

        const cleanRoom = normalizeRoomCode(roomCode);
        const uploadedItems: RelayItemMetadata[] = [];

        // Encrypt & upload files
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const rawBuffer = await file.arrayBuffer();
          const { iv, cipher } = await encryptBytes(key, rawBuffer);

          setRelayState("uploading");
          const pathname = `relay/${cleanRoom}/${i}.bin`;

          const blobResult = await upload(
            pathname,
            new Blob([cipher], { type: "application/octet-stream" }),
            {
              access: "public",
              contentType: "application/octet-stream",
              handleUploadUrl: "/api/relay/upload",
              clientPayload: JSON.stringify({ roomCode: cleanRoom, size: file.size }),
              onUploadProgress: ({ percentage }) => {
                const step = 100 / (files.length || 1);
                const overall = Math.round(i * step + (percentage * step) / 100);
                setProgress(Math.min(overall, 90));
              },
            }
          );

          uploadedItems.push({
            url: blobResult.url,
            pathname: blobResult.pathname,
            name: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            iv,
          });
        }

        // Encrypt text payload if present
        let encryptedTextPayload: { cipherText: string; iv: string } | undefined;
        if (text && text.trim()) {
          const { iv, cipher } = await encryptText(key, text.trim());
          encryptedTextPayload = {
            cipherText: bytesToBase64(new Uint8Array(cipher)),
            iv,
          };
        }

        // Attach metadata to room
        const attachRes = await fetch("/api/relay/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: cleanRoom,
            salt,
            items: uploadedItems,
            text: encryptedTextPayload,
          }),
        });

        if (!attachRes.ok) {
          const errData = await attachRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to attach relay payload");
        }

        setRelayCode(generatedCode);
        setRelayState("ready");
        setProgress(100);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload to encrypted relay.");
        setRelayState("error");
      }
    },
    [relayStatus]
  );

  // SENDER: Cancel relay and trigger server cleanup
  const cancelRelay = useCallback(async (roomCode?: string) => {
    const code = roomCode || activeRoomCodeRef.current;
    if (code) {
      const clean = normalizeRoomCode(code);
      await fetch("/api/relay/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: clean }),
      }).catch(() => {});
    }
    setRelayState("idle");
    setRelayCode(null);
    setProgress(0);
    setError(null);
  }, []);

  // Stop polling receiver timer
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
    pollCountRef.current = 0;
  }, []);

  // RECEIVER: Poll for relay attachment (every 4s for at most 120s)
  const pollRelay = useCallback(
    (roomCode: string) => {
      stopPolling();
      const clean = normalizeRoomCode(roomCode);
      if (!clean) return;

      activeRoomCodeRef.current = clean;
      setIsPolling(true);
      pollCountRef.current = 0;

      const check = async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > 30) {
          stopPolling();
          return;
        }

        try {
          const res = await fetch(`/api/relay/attach?code=${encodeURIComponent(clean)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.relay) {
              setRelayPayload(data.relay);
              stopPolling();
            }
          }
        } catch {
          // Ignore network glitch during polling
        }
      };

      // Immediate check then 4-second interval
      check();
      pollTimerRef.current = setInterval(check, 4000);
    },
    [stopPolling]
  );

  // RECEIVER: Download, decrypt and complete relay
  const downloadRelay = useCallback(
    async (payload: RelayPayloadData, inputCode: string, roomCode?: string) => {
      const normalizedCode = normalizeRelayCode(inputCode);
      if (!normalizedCode) {
        setError("Wrong relay code");
        await Promise.resolve();
        throw new Error("Wrong relay code");
      }

      const targetRoom = roomCode || activeRoomCodeRef.current || "";
      const cleanRoom = normalizeRoomCode(targetRoom);

      setIsDownloading(true);
      setError(null);

      try {
        const key = await deriveRelayKey(normalizedCode, payload.salt);

        // Fetch & decrypt files
        for (const item of payload.items) {
          const res = await fetch(item.url);
          if (!res.ok) {
            throw new Error("Failed to download encrypted file");
          }
          const cipherBuffer = await res.arrayBuffer();
          const plainBuffer = await decryptBytes(key, item.iv, cipherBuffer);

          const blob = new Blob([plainBuffer], { type: item.mimeType || "application/octet-stream" });
          const objectUrl = URL.createObjectURL(blob);
          try {
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = item.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }

          addTransferHistoryItem({
            direction: "received",
            mode: "internet",
            itemType: "file",
            name: item.name,
            size: item.size,
            status: "completed",
          });
        }

        // Decrypt text to clipboard if present
        if (payload.text) {
          const cipherBytes = base64ToBytes(payload.text.cipherText);
          const plainText = await decryptText(
            key,
            payload.text.iv,
            cipherBytes as unknown as BufferSource
          );
          try {
            await navigator.clipboard.writeText(plainText);
          } catch {
            // Ignore clipboard permission error
          }

          addTransferHistoryItem({
            direction: "received",
            mode: "internet",
            itemType: "text",
            name: "Text snippet",
            textSnippet: plainText.slice(0, 100),
            status: "completed",
          });
        }

        // Successfully decrypted: delete blobs from cloud store
        if (cleanRoom) {
          await fetch("/api/relay/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: cleanRoom }),
          }).catch(() => {});
        }

        setRelayPayload(null);
      } catch {
        setError("Wrong relay code");
        // Do NOT call complete on decrypt failure
        throw new Error("Wrong relay code");
      } finally {
        setIsDownloading(false);
      }
    },
    []
  );

  return {
    relayStatus,
    relayState,
    progress,
    relayCode,
    error,
    relayPayload,
    isPolling,
    isDownloading,
    startRelayUpload,
    cancelRelay,
    pollRelay,
    stopPolling,
    downloadRelay,
  };
}
