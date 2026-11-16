"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  KeyRound,
  Phone,
  Sparkles,
  ArrowRight,
  Camera,
  RefreshCw,
  AlertCircle,
  Users,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { QRScannerModal } from "@/components/QRScannerModal";
import { TransferModal } from "@/components/TransferModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useWebRTC } from "@/hooks/useWebRTC";
import { formatRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import { getPayloadBytes } from "@/lib/transferEstimate";
import type { TransferRole } from "@/types/mode";
import type { TransferProgressState } from "@/types/transfer";

type KeyStrategy = "auto" | "phone" | "keyword" | "qr";

interface InternetSharingCardProps {
  initialRoomCode?: string;
}

export function InternetSharingCard({ initialRoomCode }: InternetSharingCardProps) {
  const isInitialReceive = Boolean(initialRoomCode && isValidRoomCode(initialRoomCode));
  const [role, setRole] = useState<TransferRole>(isInitialReceive ? "receive" : "send");
  const [keyStrategy, setKeyStrategy] = useState<KeyStrategy>("auto");
  const [customSenderKey, setCustomSenderKey] = useState("");
  const [inputCode, setInputCode] = useState(initialRoomCode || "");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasAutoConnectedRef = useRef(false);

  const {
    role: rtcRole,
    roomCode,
    isConnected,
    progress,
    brokerNotice,
    startSender,
    startReceiver,
    sendFiles,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
  } = useWebRTC("internet");

  // Enrich sender progress with selected payload metadata so it never displays "0 Bytes"
  const enrichedProgress: TransferProgressState = {
    ...progress,
    fileName: progress.fileName || selectedPayload.files[0]?.name,
    fileSize:
      progress.fileSize ||
      (selectedPayload.files.length > 0
        ? selectedPayload.files.reduce((acc, f) => acc + f.size, 0)
        : undefined),
    totalBytes:
      progress.totalBytes > 0
        ? progress.totalBytes
        : getPayloadBytes(selectedPayload.files, selectedPayload.text),
    totalFiles:
      progress.totalFiles ||
      (selectedPayload.files.length > 1 ? selectedPayload.files.length : undefined),
    itemType: progress.itemType || (selectedPayload.files.length > 0 ? "file" : "text"),
    textContent: progress.textContent || selectedPayload.text,
  };

  // Only open modal on Sender when peer initiates connection/transfer (waiting-acceptance, transferring, completed, error)
  // While Sender is waiting for a peer (status === "connecting" or "idle"), keep QR/PIN 100% visible
  const isSenderWaiting = role === "send" && (progress.status === "idle" || progress.status === "connecting");
  const isModalOpen = !isSenderWaiting && progress.status !== "idle";

  // Sender session start
  const handleStartSender = async () => {
    if (selectedPayload.files.length === 0 && !selectedPayload.text.trim()) {
      setErrorMsg("Please select at least one file or enter text to share.");
      return;
    }

    let codeToUse: string | undefined = undefined;
    if (keyStrategy === "phone" || keyStrategy === "keyword") {
      const clean = normalizeRoomCode(customSenderKey);
      if (!isValidRoomCode(clean)) {
        setErrorMsg(
          keyStrategy === "phone"
            ? "Please enter a valid mobile number (e.g. 01712345678)."
            : "Please enter a valid keyword (4–20 characters, e.g. HR998877)."
        );
        return;
      }
      codeToUse = clean;
    }

    try {
      setIsConnecting(true);
      setErrorMsg(null);
      await startSender(codeToUse);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create sharing session.");
    } finally {
      setIsConnecting(false);
    }
  };

  // When sender dataChannel connects to receiver, automatically stream payload
  useEffect(() => {
    if (rtcRole === "sender" && isConnected && progress.status === "connecting") {
      if (selectedPayload.files.length > 0) {
        sendFiles(selectedPayload.files).catch((err) => {
          setErrorMsg(err.message);
        });
      } else if (selectedPayload.text.trim()) {
        sendPayload({ text: selectedPayload.text }).catch((err) => {
          setErrorMsg(err.message);
        });
      }
    }
  }, [rtcRole, isConnected, progress.status, selectedPayload, sendFiles, sendPayload]);

  // Receiver session start
  const handleStartReceiver = useCallback(
    async (codeToUse?: string) => {
      const code = normalizeRoomCode(codeToUse || inputCode);
      if (!isValidRoomCode(code)) {
        setErrorMsg("Please enter a valid room PIN, Mobile Number, or Keyword.");
        return;
      }

      try {
        setIsConnecting(true);
        setErrorMsg(null);
        await startReceiver(code);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to join room. Verify key & retry.");
      } finally {
        setIsConnecting(false);
      }
    },
    [inputCode, startReceiver]
  );

  // Auto-connect receiver ONCE if initialRoomCode was passed in URL query param (?room=123456)
  useEffect(() => {
    if (
      initialRoomCode &&
      isValidRoomCode(normalizeRoomCode(initialRoomCode)) &&
      !hasAutoConnectedRef.current
    ) {
      hasAutoConnectedRef.current = true;
      const clean = normalizeRoomCode(initialRoomCode);
      const timer = setTimeout(() => {
        handleStartReceiver(clean);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [initialRoomCode, handleStartReceiver]);

  const handleScannerSuccess = (scannedCode: string) => {
    setInputCode(scannedCode);
    handleStartReceiver(scannedCode);
  };

  const handleReset = () => {
    hasAutoConnectedRef.current = true;
    cleanup();
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. ROLE SWITCHER (Segmented Pill Style inspired by demo images) */}
      {!roomCode && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
          <div>
            <h3 className="font-bold text-base text-[var(--text)]">
              {role === "send" ? "Send Files or Text" : "Receive Files"}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {role === "send"
                ? "Choose your pairing key method and drop files"
                : "Enter the sender's PIN, mobile number, or scan QR"}
            </p>
          </div>

          {/* Role selector */}
          <SegmentedControl
            ariaLabel="Transfer Role"
            value={role}
            onChange={(val) => setRole(val as TransferRole)}
            options={[
              { value: "send", label: "Send" },
              { value: "receive", label: "Receive" },
            ]}
          />
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. SENDER VIEW */}
      {role === "send" && (
        <div className="space-y-6">
          {!roomCode ? (
            <div className="space-y-5">
              {/* Key Strategy Segmented Pills */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Pairing Method
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {keyStrategy === "phone"
                      ? "Use your phone number"
                      : keyStrategy === "keyword"
                      ? "Use custom secret key"
                      : keyStrategy === "qr"
                      ? "Scan dynamic QR code"
                      : "Instant 6-digit random PIN"}
                  </span>
                </div>

                {/* Pairing method selector */}
                <SegmentedControl
                  ariaLabel="Pairing Method"
                  value={keyStrategy}
                  onChange={(val) => setKeyStrategy(val as KeyStrategy)}
                  options={[
                    { value: "auto", label: "Auto PIN" },
                    { value: "phone", label: "Mobile No." },
                    { value: "keyword", label: "Keyword" },
                    { value: "qr", label: "QR Code" },
                  ]}
                />

                {/* Sub-input for Mobile Number */}
                {keyStrategy === "phone" && (
                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2 animate-in fade-in">
                    <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <span>Sender Mobile Number</span>
                    </label>
                    <input
                      type="text"
                      value={customSenderKey}
                      onChange={(e) => setCustomSenderKey(e.target.value)}
                      placeholder="e.g. 01712345678"
                      className="w-full p-3 text-sm font-mono rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Use a phone number you already know by heart so you can easily type it on the receiving device.
                    </p>
                  </div>
                )}

                {/* Sub-input for Keyword */}
                {keyStrategy === "keyword" && (
                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2 animate-in fade-in">
                    <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <span>Custom Secret Keyword</span>
                    </label>
                    <input
                      type="text"
                      value={customSenderKey}
                      onChange={(e) => setCustomSenderKey(e.target.value)}
                      placeholder="e.g. HR998877 or LAB2026"
                      className="w-full p-3 text-sm font-mono uppercase font-bold rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Type any secret code word. You and the receiver will use this exact key to connect.
                    </p>
                  </div>
                )}
              </div>

              {/* Payload Dropzone */}
              <div className="space-y-2">
                <Dropzone onSelectionChange={setSelectedPayload} />
                <EstimateBadge
                  channel="internet"
                  totalBytes={getPayloadBytes(selectedPayload.files, selectedPayload.text)}
                />
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleStartSender}
                disabled={isConnecting}
                className="w-full py-3.5 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {keyStrategy === "phone"
                        ? "Share with Mobile Number"
                        : keyStrategy === "keyword"
                        ? "Share with Keyword"
                        : "Send Files"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Active Sender Session Display */
            <div className="space-y-6 flex flex-col items-center py-2">
              <QRCodeDisplay code={roomCode} />

              {/* Peer Status Pill */}
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs font-mono text-[var(--text)] shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isConnected ? "bg-emerald-400" : "bg-indigo-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isConnected ? "bg-emerald-500" : "bg-indigo-500"
                    }`}
                  />
                </span>
                <span>
                  {isConnected
                    ? "Peer Connected! Streaming payload..."
                    : `Waiting for receiver to connect... (${formatRoomCode(roomCode)})`}
                </span>
              </div>

              {/* Informative Broker Notice if cloud broker is offline */}
              {brokerNotice && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] font-mono">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>{brokerNotice}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
              >
                Cancel &amp; Close Session
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. RECEIVER VIEW */}
      {role === "receive" && (
        <div className="space-y-5">
          {!roomCode ? (
            <div className="space-y-5 max-w-md mx-auto">
              <div className="p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center space-y-4">
                <div className="h-11 w-11 mx-auto rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xs flex items-center justify-center text-[var(--text)]">
                  <KeyRound className="h-5 w-5" />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[var(--text)]">
                    Enter Pairing Key
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Enter the 6-digit PIN, sender&apos;s phone number, or secret keyword
                  </p>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    maxLength={20}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="e.g. 834-291 or 01712345678"
                    className="w-full py-3 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] text-center font-mono font-bold text-base tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:font-normal placeholder:tracking-normal placeholder:text-[var(--text-muted)]"
                  />

                  <button
                    type="button"
                    onClick={() => handleStartReceiver()}
                    disabled={isConnecting || !isValidRoomCode(inputCode)}
                    className="w-full py-3.5 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect to Session</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Camera Scanner Divider & Button */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[var(--border-hairline)]" />
                <span className="flex-shrink mx-4 text-[var(--text-muted)] text-xs font-mono">
                  OR
                </span>
                <div className="flex-grow border-t border-[var(--border-hairline)]" />
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-3 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text)] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <Camera className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Scan Camera QR Code</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center max-w-md mx-auto py-4">
              <div className="p-8 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xs flex items-center justify-center text-[var(--text)]">
                  <Users className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-[var(--text)]">
                    Connecting to &ldquo;{formatRoomCode(roomCode)}&rdquo;
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {isConnected
                      ? "Connected to sender! Awaiting payload..."
                      : "Exchanging WebRTC signaling..."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
              >
                Disconnect &amp; Leave
              </button>
            </div>
          )}
        </div>
      )}

      {/* QR Scanner Camera Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScannerSuccess}
      />

      {/* Live Transfer & Acceptance Modal */}
      <TransferModal
        isOpen={isModalOpen}
        progress={enrichedProgress}
        roomCode={roomCode || inputCode}
        onAccept={acceptIncomingTransfer}
        onReject={rejectIncomingTransfer}
        onClose={handleReset}
      />
    </div>
  );
}
