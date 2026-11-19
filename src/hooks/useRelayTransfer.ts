"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  generateRelayCode,
  normalizeRelayCode,
  generateSalt,
  generateIvPrefix,
  deriveRelayKey,
  encryptChunk,
  decryptChunk,
  encryptText,
  decryptText,
} from "@/lib/relayCrypto";
import {
  newRelayId,
  newFileId,
  planChunks,
  chunkPath,
  chunkAad,
  cipherSize,
} from "@/lib/relayChunks";
import {
  RELAY_CHUNK_BYTES,
  RELAY_MAX_FILE_BYTES,
  RELAY_MAX_TRANSFER_BYTES,
  RELAY_MAX_FILES,
  RELAY_TTL_MINUTES,
} from "@/lib/relayLimits";
import { createDiskStreamWriter, DISK_STREAM_THRESHOLD } from "@/lib/diskStream";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import { normalizeRoomCode } from "@/lib/codeGenerator";

export type RelayState = "idle" | "encrypting" | "uploading" | "registering" | "ready" | "error";

export interface RelayStatus {
  available: boolean;
  maxFileBytes: number;
  maxTransferBytes: number;
  maxFiles: number;
  chunkBytes: number;
  ttlMinutes: number;
}

export interface RelayFileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  chunkCount: number;
  ivPrefix: string;
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
  createdAt?: number;
  rid?: string;
  baseUrl?: string;
  files?: RelayFileMetadata[];
  items?: RelayItemMetadata[];
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

const FORBIDDEN_HEADERS = new Set([
  "content-length",
  "host",
  "connection",
  "keep-alive",
  "user-agent",
  "referer",
  "cookie",
]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOnline(signal?: AbortSignal): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await new Promise<void>((resolve, reject) => {
      const onOnline = () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("online", onOnline);
        }
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("online", onOnline);
        }
        signal?.removeEventListener("abort", onAbort);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (typeof window !== "undefined") {
        window.addEventListener("online", onOnline);
      }
      signal?.addEventListener("abort", onAbort);
    });
  }
}

export function useRelayTransfer() {
  const [relayStatus, setRelayStatus] = useState<RelayStatus | null>(null);
  const [relayState, setRelayState] = useState<RelayState>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [chunksDone, setChunksDone] = useState(0);
  const [chunksTotal, setChunksTotal] = useState(0);
  const [relayCode, setRelayCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relayPayload, setRelayPayload] = useState<RelayPayloadData | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const activeRoomCodeRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
          setRelayStatus({
            available: false,
            maxFileBytes: RELAY_MAX_FILE_BYTES,
            maxTransferBytes: RELAY_MAX_TRANSFER_BYTES,
            maxFiles: RELAY_MAX_FILES,
            chunkBytes: RELAY_CHUNK_BYTES,
            ttlMinutes: RELAY_TTL_MINUTES,
          });
        }
      });

    return () => {
      mounted = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // SENDER: Upload encrypted chunks to temporary cloud relay
  const startRelayUpload = useCallback(
    async (roomCode: string, files: File[], text?: string) => {
      if (!relayStatus?.available) {
        setError("Encrypted cloud relay is not available.");
        setRelayState("error");
        return;
      }

      const maxFiles = relayStatus.maxFiles || RELAY_MAX_FILES;
      const maxFileBytes = relayStatus.maxFileBytes || RELAY_MAX_FILE_BYTES;
      const maxTransferBytes = relayStatus.maxTransferBytes || RELAY_MAX_TRANSFER_BYTES;

      if (files.length > maxFiles) {
        setError(`Cannot send more than ${maxFiles} files via relay.`);
        setRelayState("error");
        return;
      }

      for (const file of files) {
        if (file.size > maxFileBytes) {
          setError(`File "${file.name}" exceeds the 200MB relay limit.`);
          setRelayState("error");
          return;
        }
      }

      const totalFilesBytes = files.reduce((acc, f) => acc + f.size, 0);
      if (totalFilesBytes > maxTransferBytes) {
        setError("Total transfer size exceeds relay limit.");
        setRelayState("error");
        return;
      }

      if (files.length === 0 && (!text || !text.trim())) {
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const signal = abortController.signal;

      try {
        setError(null);
        setRelayState("encrypting");
        activeRoomCodeRef.current = roomCode;
        const cleanRoom = normalizeRoomCode(roomCode);

        const generatedCode = generateRelayCode();
        const salt = generateSalt();
        const key = await deriveRelayKey(generatedCode, salt);

        const rid = newRelayId();

        // Plan chunk tasks
        interface ChunkTask {
          file: File;
          fileId: string;
          ivPrefix: string;
          index: number;
          start: number;
          end: number;
          chunkCount: number;
          globalIndex: number;
        }

        const tasks: ChunkTask[] = [];
        const filesMeta: RelayFileMetadata[] = [];
        let globalIndex = 0;

        for (const file of files) {
          const fileId = newFileId();
          const ivPrefix = generateIvPrefix();
          const plans = planChunks(file.size);
          filesMeta.push({
            id: fileId,
            name: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            chunkCount: plans.length,
            ivPrefix,
          });

          for (const plan of plans) {
            tasks.push({
              file,
              fileId,
              ivPrefix,
              index: plan.index,
              start: plan.start,
              end: plan.end,
              chunkCount: plans.length,
              globalIndex: globalIndex++,
            });
          }
        }

        const totalChunks = tasks.length;
        setChunksTotal(totalChunks);
        setChunksDone(0);
        setTotalBytes(totalFilesBytes);
        setUploadedBytes(0);
        setProgress(5);

        let bytesUploaded = 0;
        let chunksCompleted = 0;
        let discoveredBaseUrl = "";

        const BATCH_SIZE = 32;
        const RETRY_BACKOFFS = [500, 1000, 2000];

        setRelayState("uploading");

        // Process batches of at most 32 chunks
        for (let b = 0; b < tasks.length; b += BATCH_SIZE) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          await waitForOnline(signal);

          const batchTasks = tasks.slice(b, b + BATCH_SIZE);
          const chunkRequests = batchTasks.map((t) => {
            const path = chunkPath(cleanRoom, rid, t.fileId, t.index);
            const plainBytes = t.end - t.start;
            return { path, size: cipherSize(plainBytes) };
          });

          const uploadRes = await fetch("/api/relay/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: cleanRoom, rid, chunks: chunkRequests }),
            signal,
          });

          if (!uploadRes.ok) {
            throw new Error(
              `Upload failed at chunk ${batchTasks[0].globalIndex + 1} of ${totalChunks}: HTTP ${uploadRes.status}`
            );
          }

          const uploadData = (await uploadRes.json()) as {
            urls?: { path: string; url: string; headers?: Record<string, string> }[];
            error?: string;
          };

          if (!uploadData.urls || uploadData.urls.length !== batchTasks.length) {
            throw new Error(uploadData.error || "Failed to get upload URLs");
          }

          if (!discoveredBaseUrl && uploadData.urls.length > 0) {
            try {
              discoveredBaseUrl = new URL(uploadData.urls[0].url).origin;
            } catch {
              // Ignore invalid origin
            }
          }

          // Upload chunks with concurrency 3
          let batchTaskIndex = 0;
          const uploadWorker = async () => {
            while (batchTaskIndex < batchTasks.length) {
              if (signal.aborted) throw new DOMException("Aborted", "AbortError");
              const currentIdx = batchTaskIndex++;
              if (currentIdx >= batchTasks.length) break;

              const t = batchTasks[currentIdx];
              const signed = uploadData.urls![currentIdx];
              const plainBytes = t.end - t.start;

              // Encrypt on demand to avoid holding full files in RAM
              const rawBuffer = await t.file.slice(t.start, t.end).arrayBuffer();
              const aad = chunkAad(t.fileId, t.index, t.chunkCount);
              const cipher = await encryptChunk(key, rawBuffer, t.ivPrefix, t.index, aad);

              const putHeaders: Record<string, string> = {
                "Content-Type": "application/octet-stream",
              };
              if (signed.headers) {
                for (const [hk, hv] of Object.entries(signed.headers)) {
                  if (!FORBIDDEN_HEADERS.has(hk.toLowerCase())) {
                    putHeaders[hk] = hv;
                  }
                }
              }

              let attempt = 0;
              let lastError: Error | null = null;
              let success = false;

              while (attempt <= 3) {
                if (signal.aborted) throw new DOMException("Aborted", "AbortError");
                await waitForOnline(signal);

                try {
                  const putRes = await fetch(signed.url, {
                    method: "PUT",
                    headers: putHeaders,
                    body: cipher,
                    signal,
                  });

                  if (putRes.ok) {
                    success = true;
                    break;
                  }

                  lastError = new Error(
                    `Upload failed at chunk ${t.globalIndex + 1} of ${totalChunks}: HTTP ${putRes.status}`
                  );
                } catch (fetchErr) {
                  if (signal.aborted) throw fetchErr;
                  if (typeof navigator !== "undefined" && navigator.onLine === false) {
                    await waitForOnline(signal);
                    continue;
                  }
                  lastError = new Error("Could not reach storage (network or CORS)");
                }

                if (attempt < 3) {
                  await delay(RETRY_BACKOFFS[attempt]);
                }
                attempt++;
              }

              if (!success) {
                throw (
                  lastError ||
                  new Error(`Upload failed at chunk ${t.globalIndex + 1} of ${totalChunks}`)
                );
              }

              chunksCompleted++;
              bytesUploaded += plainBytes;
              setChunksDone(chunksCompleted);
              setUploadedBytes(bytesUploaded);
              if (totalFilesBytes > 0) {
                setProgress(Math.round((bytesUploaded / totalFilesBytes) * 90));
              }
            }
          };

          await Promise.all([uploadWorker(), uploadWorker(), uploadWorker()]);
        }

        // Encrypt optional text payload
        let encryptedTextPayload: { cipherText: string; iv: string } | undefined;
        if (text && text.trim()) {
          const { iv, cipher } = await encryptText(key, text.trim());
          encryptedTextPayload = {
            cipherText: bytesToBase64(new Uint8Array(cipher)),
            iv,
          };
        }

        // Register payload with room
        setRelayState("registering");
        setProgress(95);

        const attachPayload =
          files.length > 0
            ? {
                roomCode: cleanRoom,
                rid,
                salt,
                baseUrl: discoveredBaseUrl,
                files: filesMeta,
                text: encryptedTextPayload,
              }
            : {
                roomCode: cleanRoom,
                salt,
                items: [],
                text: encryptedTextPayload,
              };

        const attachRes = await fetch("/api/relay/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attachPayload),
          signal,
        });

        if (!attachRes.ok) {
          throw new Error(`Register failed: HTTP ${attachRes.status}`);
        }

        setRelayCode(generatedCode);
        setRelayState("ready");
        setProgress(100);
      } catch (err) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to upload to encrypted relay.";
        setError(msg);
        setRelayState("error");
      }
    },
    [relayStatus]
  );

  // SENDER: Cancel relay and trigger server cleanup
  const cancelRelay = useCallback(async (roomCode?: string | null) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
    setUploadedBytes(0);
    setDownloadedBytes(0);
    setTotalBytes(0);
    setChunksDone(0);
    setChunksTotal(0);
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
        throw new Error("Wrong relay code");
      }

      const targetRoom = roomCode || activeRoomCodeRef.current || "";
      const cleanRoom = normalizeRoomCode(targetRoom);

      setIsDownloading(true);
      setError(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const signal = abortController.signal;

      let total = 0;
      if (payload.files && payload.files.length > 0) {
        total = payload.files.reduce((acc, f) => acc + f.size, 0);
      } else if (payload.items && payload.items.length > 0) {
        total = payload.items.reduce((acc, it) => acc + it.size, 0);
      }
      setTotalBytes(total);
      setDownloadedBytes(0);
      setProgress(0);

      try {
        const key = await deriveRelayKey(normalizedCode, payload.salt);
        let bytesDownloaded = 0;

        // Chunk-based files
        if (payload.files && payload.files.length > 0 && payload.rid) {
          const rid = payload.rid;
          const baseUrl = payload.baseUrl ? payload.baseUrl.replace(/\/+$/, "") : "";

          for (const file of payload.files) {
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");

            const isLarge = file.size > DISK_STREAM_THRESHOLD;
            const diskWriter = isLarge ? await createDiskStreamWriter(file.name) : null;
            const blobParts: BlobPart[] = [];

            try {
              const chunkBuffers: (ArrayBuffer | null)[] = new Array(file.chunkCount).fill(null);
              let downloadIdx = 0;
              let writeIdx = 0;
              let downloadError: Error | null = null;

              const downloadWorker = async () => {
                while (downloadIdx < file.chunkCount) {
                  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
                  if (downloadError) return;

                  // Maintain window of at most 2 chunks ahead of writer
                  while (downloadIdx - writeIdx >= 2) {
                    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
                    if (downloadError) return;
                    await delay(10);
                  }

                  const idx = downloadIdx++;
                  if (idx >= file.chunkCount) break;

                  try {
                    const path = chunkPath(cleanRoom, rid, file.id, idx);
                    let cipherBuffer: ArrayBuffer | null = null;

                    // 1. Direct fetch from storage bucket
                    if (baseUrl) {
                      try {
                        const directRes = await fetch(`${baseUrl}/${path}`, { signal });
                        if (directRes.ok) {
                          cipherBuffer = await directRes.arrayBuffer();
                        }
                      } catch {
                        // Fall back on network or CORS error
                      }
                    }

                    // 2. Fallback to /api/relay/file
                    if (!cipherBuffer) {
                      const fallbackRes = await fetch(
                        `/api/relay/file?code=${encodeURIComponent(cleanRoom)}&f=${encodeURIComponent(file.id)}&i=${idx}`,
                        { signal }
                      );
                      if (!fallbackRes.ok) {
                        throw new Error(`Failed to download encrypted chunk ${idx} of file ${file.name}`);
                      }
                      cipherBuffer = await fallbackRes.arrayBuffer();
                    }

                    const aad = chunkAad(file.id, idx, file.chunkCount);
                    const plainBuffer = await decryptChunk(key, cipherBuffer, file.ivPrefix, idx, aad);
                    chunkBuffers[idx] = plainBuffer;
                  } catch (err) {
                    downloadError = err instanceof Error ? err : new Error(String(err));
                    break;
                  }
                }
              };

              const workersPromise = Promise.all([downloadWorker(), downloadWorker()]);

              // Write chunks in strict sequential order
              while (writeIdx < file.chunkCount) {
                if (signal.aborted) throw new DOMException("Aborted", "AbortError");
                while (!chunkBuffers[writeIdx]) {
                  if (downloadError) throw downloadError;
                  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
                  await delay(10);
                }

                const plain = chunkBuffers[writeIdx]!;
                chunkBuffers[writeIdx] = null; // Free chunk memory immediately

                if (diskWriter) {
                  await diskWriter.writeChunk(plain);
                } else {
                  blobParts.push(plain);
                }

                bytesDownloaded += plain.byteLength;
                setDownloadedBytes(bytesDownloaded);
                if (total > 0) {
                  setProgress(Math.round((bytesDownloaded / total) * 100));
                }

                writeIdx++;
              }

              await workersPromise;
              if (downloadError) throw downloadError;

              if (diskWriter) {
                await diskWriter.close();
              } else {
                const blob = new Blob(blobParts, {
                  type: file.mimeType || "application/octet-stream",
                });
                const objectUrl = URL.createObjectURL(blob);
                try {
                  const a = document.createElement("a");
                  a.href = objectUrl;
                  a.download = file.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } finally {
                  URL.revokeObjectURL(objectUrl);
                }
              }

              addTransferHistoryItem({
                direction: "received",
                mode: "internet",
                itemType: "file",
                name: file.name,
                size: file.size,
                status: "completed",
              });
            } catch (fileErr) {
              if (diskWriter) {
                await diskWriter.abort();
              }
              throw fileErr;
            }
          }
        } else if (payload.items && payload.items.length > 0) {
          // Legacy single-item fallback
          for (let i = 0; i < payload.items.length; i++) {
            const item = payload.items[i];
            let res: Response | null = await fetch(item.url, { signal }).catch(() => null);
            if (!res || !res.ok) {
              res = await fetch(
                `/api/relay/file?code=${encodeURIComponent(cleanRoom)}&index=${i}`,
                { signal }
              ).catch(() => null);
            }
            if (!res || !res.ok) {
              throw new Error("Failed to download encrypted file");
            }
            const cipherBuffer = await res.arrayBuffer();
            const iv = base64ToBytes(item.iv);
            let plainBuffer: ArrayBuffer;
            try {
              plainBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv as unknown as BufferSource },
                key,
                cipherBuffer
              );
            } catch {
              throw new Error("Wrong relay code");
            }

            const blob = new Blob([plainBuffer], {
              type: item.mimeType || "application/octet-stream",
            });
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

            bytesDownloaded += item.size;
            setDownloadedBytes(bytesDownloaded);
            if (total > 0) {
              setProgress(Math.round((bytesDownloaded / total) * 100));
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
            // Ignore clipboard permission errors
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

        // Clean up cloud storage only after full transfer success
        if (cleanRoom) {
          await fetch("/api/relay/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: cleanRoom }),
          }).catch(() => {});
        }

        setRelayPayload(null);
      } catch (err) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to download";
        setError(msg === "Wrong relay code" ? "Wrong relay code" : msg);
        throw err;
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
    uploadedBytes,
    downloadedBytes,
    totalBytes,
    chunksDone,
    chunksTotal,
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
