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
import { upload } from "@/lib/upstashBlob";
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
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
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

  // Stop polling receiver timer
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
    pollCountRef.current = 0;
  }, []);

  // Reset relay state
  const reset = useCallback(() => {
    stopPolling();
    setRelayState("idle");
    setProgress(0);
    setRelayCode(null);
    setRoomCode(null);
    setQrUrl(null);
    setError(null);
    setRelayPayload(null);
    setIsDownloading(false);
    activeRoomCodeRef.current = null;
  }, [stopPolling]);

  // SENDER: Upload encrypted payload to temporary cloud relay
  // Accepts either (files, text) or legacy (roomCode, files, text)
  const startRelayUpload = useCallback(
    async (
      filesOrRoom: string | File[],
      filesOrText?: File[] | string,
      textArg?: string
    ) => {
      let roomCodeInput: string | undefined;
      let files: File[] = [];
      let text: string | undefined;

      if (typeof filesOrRoom === "string") {
        roomCodeInput = filesOrRoom;
        if (Array.isArray(filesOrText)) {
          files = filesOrText;
          text = textArg;
        }
      } else if (Array.isArray(filesOrRoom)) {
        files = filesOrRoom;
        if (typeof filesOrText === "string") {
          text = filesOrText;
        }
      }

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

        // Generate ONE 8-character OTP (e.g. K7M2-9QXA)
        const generatedCode = generateRelayCode();
        const normalizedFullOtp = normalizeRelayCode(generatedCode)!;
        // First 4 characters form the public room code (K7M2)
        const activeRoom = roomCodeInput
          ? normalizeRoomCode(roomCodeInput)
          : normalizedFullOtp.slice(0, 4);

        activeRoomCodeRef.current = activeRoom;

        // Derive AES-GCM 256 key from FULL 8-char OTP + random 16-byte salt
        const salt = generateSalt();
        const key = await deriveRelayKey(normalizedFullOtp, salt);

        const uploadedItems: RelayItemMetadata[] = [];

        // Encrypt & upload files
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const rawBuffer = await file.arrayBuffer();
          const { iv, cipher } = await encryptBytes(key, rawBuffer);

          setRelayState("uploading");
          const pathname = `relay/${activeRoom}/${i}.bin`;

          const blobResult = await upload(
            pathname,
            new Blob([cipher], { type: "application/octet-stream" }),
            {
              access: "public",
              contentType: "application/octet-stream",
              handleUploadUrl: "/api/relay/upload",
              clientPayload: JSON.stringify({ roomCode: activeRoom, size: file.size }),
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
            roomCode: activeRoom,
            salt,
            items: uploadedItems,
            text: encryptedTextPayload,
          }),
        });

        if (!attachRes.ok) {
          const errData = await attachRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to attach relay payload");
        }

        const origin =
          typeof window !== "undefined" &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"
            ? window.location.origin
            : "https://quicksend.vercel.app";
        const computedQrUrl = `${origin}/?room=${activeRoom}#rc=${normalizedFullOtp}`;

        setRelayCode(generatedCode);
        setRoomCode(activeRoom);
        setQrUrl(computedQrUrl);
        setRelayState("ready");
        setProgress(100);

        return {
          otp: generatedCode,
          roomCode: activeRoom,
          qrUrl: computedQrUrl,
        };
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

  // RECEIVER: Receive via OTP string or scanned QR URL (?room=...#rc=...)
  const receiveByOtp = useCallback(
    async (input: string) => {
      if (!input || !input.trim()) {
        throw new Error("Please enter an OTP or scan a QR code.");
      }

      setError(null);
      setIsDownloading(true);

      try {
        let extractedRoom = "";
        let extractedOtp = "";

        const trimmed = input.trim();

        // 1. Check if input is a URL or query string with room and rc
        if (trimmed.includes("room=") || trimmed.includes("rc=")) {
          const matchRoom = trimmed.match(/[?&]room=([a-zA-Z0-9_-]+)/i);
          const matchRc = trimmed.match(/[#&?]rc=([a-zA-Z0-9_-]+)/i);
          if (matchRoom && matchRoom[1]) {
            extractedRoom = normalizeRoomCode(matchRoom[1]);
          }
          if (matchRc && matchRc[1]) {
            extractedOtp = normalizeRelayCode(matchRc[1]) || matchRc[1].toUpperCase();
          }
        }

        // 2. If it's a raw OTP (e.g. "K7M2-9QXA" or "K7M29QXA")
        if (!extractedOtp) {
          const clean = normalizeRelayCode(trimmed);
          if (clean && clean.length === 8) {
            extractedOtp = clean;
            if (!extractedRoom) {
              extractedRoom = clean.slice(0, 4);
            }
          } else {
            const cleanRaw = trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            if (cleanRaw.length >= 8) {
              extractedOtp = cleanRaw.slice(0, 8);
              extractedRoom = extractedOtp.slice(0, 4);
            } else if (cleanRaw.length >= 4) {
              extractedRoom = cleanRaw;
              extractedOtp = cleanRaw;
            }
          }
        }

        if (!extractedRoom && extractedOtp && extractedOtp.length >= 4) {
          extractedRoom = extractedOtp.slice(0, 4);
        }

        if (!extractedRoom) {
          throw new Error("Invalid OTP code. Please check and try again.");
        }

        activeRoomCodeRef.current = extractedRoom;

        // Fetch relay payload from server
        const res = await fetch(`/api/relay/attach?code=${encodeURIComponent(extractedRoom)}`);
        if (!res.ok) {
          throw new Error("Transfer not found or expired. Check the OTP.");
        }
        const data = await res.json();
        if (!data.relay) {
          throw new Error("Transfer not found or expired. Check the OTP.");
        }

        // Download, decrypt and complete
        await downloadRelay(data.relay, extractedOtp, extractedRoom);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to receive transfer.";
        setError(msg);
        throw err;
      } finally {
        setIsDownloading(false);
      }
    },
    [downloadRelay]
  );

  return {
    relayStatus,
    relayState,
    progress,
    relayCode,
    roomCode,
    qrUrl,
    error,
    relayPayload,
    isPolling,
    isDownloading,
    startRelayUpload,
    cancelRelay,
    pollRelay,
    stopPolling,
    downloadRelay,
    receiveByOtp,
    reset,
  };
}
