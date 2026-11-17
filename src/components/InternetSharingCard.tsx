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
  Lock,
  Copy,
  Check,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { QRScannerModal } from "@/components/QRScannerModal";
import { TransferModal } from "@/components/TransferModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ConnectionDiagnostics } from "@/components/ConnectionDiagnostics";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useRelayTransfer } from "@/hooks/useRelayTransfer";
import { formatRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import { getPayloadBytes } from "@/lib/transferEstimate";
import type { TransferRole } from "@/types/mode";
import type { TransferProgressState } from "@/types/transfer";

type KeyStrategy = "auto" | "phone" | "keyword";

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
  const [hasTurn, setHasTurn] = useState<boolean | null>(null);
  const [showRelayConsent, setShowRelayConsent] = useState(false);
  const [copiedRelayCode, setCopiedRelayCode] = useState(false);
  const hasAutoConnectedRef = useRef(false);

  const {
    relayStatus,
    relayState,
    progress: relayProgress,
    relayCode,
    error: relayError,
    relayPayload,
    isDownloading: isDownloadingRelay,
    startRelayUpload,
    cancelRelay,
    pollRelay,
    stopPolling,
    downloadRelay,
  } = useRelayTransfer();

  // Check /api/turn once when Mode 1 opens to detect TURN relay availability
  useEffect(() => {
    fetch("/api/turn")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.hasTurn === "boolean") {
          setHasTurn(data.hasTurn);
        }
      })
      .catch(() => {});
  }, []);

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
    diagnostics,
    debugLog,
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

  // Auto-start sender session with Auto PIN on mount or when switching to send role
  useEffect(() => {
    if (role === "send" && !roomCode && !isConnecting && keyStrategy === "auto") {
      startSender().catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Failed to initialize sender session.");
      });
    }
  }, [role, roomCode, isConnecting, keyStrategy, startSender]);

  // Handle switching pairing method in Send view
  const handleKeyStrategyChange = (newStrategy: KeyStrategy) => {
    setKeyStrategy(newStrategy);
    setErrorMsg(null);
    if (newStrategy === "auto") {
      startSender().catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Failed to create PIN session.");
      });
    }
  };

  // Apply custom mobile number or keyword as sender key
  const handleApplyCustomKey = (key: string) => {
    const clean = normalizeRoomCode(key);
    if (!isValidRoomCode(clean)) {
      setErrorMsg(
        keyStrategy === "phone"
          ? "Please enter a valid mobile number (e.g. 01712345678)."
          : "Please enter a valid keyword (4–20 characters, e.g. HR998877)."
      );
      return;
    }
    setErrorMsg(null);
    startSender(clean).catch((err) => {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create custom key session.");
    });
  };

  // Refresh auto-generated PIN
  const handleRefreshAutoPin = () => {
    setErrorMsg(null);
    startSender().catch((err) => {
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate new PIN.");
    });
  };

  // When sender dataChannel connects to receiver, automatically stream payload
  useEffect(() => {
    if (rtcRole === "sender" && isConnected && (progress.status === "connecting" || progress.status === "idle")) {
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
        pollRelay(code);
        await startReceiver(code);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to join room. Verify key & retry.");
      } finally {
        setIsConnecting(false);
      }
    },
    [inputCode, startReceiver, pollRelay]
  );

  // Stop polling relay when WebRTC connection succeeds
  useEffect(() => {
    if (isConnected) {
      stopPolling();
    }
  }, [isConnected, stopPolling]);

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
    stopPolling();
    cancelRelay();
    cleanup();
    setErrorMsg(null);
    if (role === "send") {
      startSender().catch(() => {});
    }
  };

  const handleRoleChange = (newRole: TransferRole) => {
    if (newRole !== role) {
      cleanup();
      setRole(newRole);
      setErrorMsg(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP ROLE SWITCHER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">
            {role === "send" ? "Send Files or Text" : "Receive Files"}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {role === "send"
              ? "Share via instant QR code or 6-digit PIN"
              : "Scan sender's QR code or enter their PIN"}
          </p>
        </div>

        {/* Role selector */}
        <SegmentedControl
          ariaLabel="Transfer Role"
          value={role}
          onChange={(val) => handleRoleChange(val as TransferRole)}
          options={[
            { value: "send", label: "Send" },
            { value: "receive", label: "Receive" },
          ]}
        />
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Subtle TURN Relay Notice */}
      {hasTurn === false && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <span>TURN relay not configured — works on same Wi-Fi; 4G mobile data may require TURN.</span>
        </div>
      )}

      {/* 2. SENDER VIEW */}
      {role === "send" && (
        <div className="space-y-6">
          {/* STEP 1: SELECT FILES OR TEXT */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--text)] block">
              1. Select Files or Text to Send
            </span>
            <Dropzone onSelectionChange={setSelectedPayload} />
            <EstimateBadge
              channel="internet"
              totalBytes={getPayloadBytes(selectedPayload.files, selectedPayload.text)}
            />

            {Boolean(relayStatus?.available) &&
              (selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0) && (
                <div className="space-y-3 pt-1">
                  {!showRelayConsent && relayState === "idle" && (
                    <button
                      type="button"
                      onClick={() => setShowRelayConsent(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <span>Send via encrypted cloud relay</span>
                    </button>
                  )}

                  {showRelayConsent && relayState === "idle" && (
                    <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3 animate-in fade-in">
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        This uploads an encrypted copy to temporary cloud storage. It is deleted after download or within 24 hours.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowRelayConsent(false);
                            if (roomCode) {
                              startRelayUpload(roomCode, selectedPayload.files, selectedPayload.text);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-semibold text-xs cursor-pointer transition-colors"
                        >
                          Continue
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRelayConsent(false)}
                          className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--surface-muted)] text-[var(--text)] font-semibold text-xs cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {(relayState === "encrypting" || relayState === "uploading") && (
                    <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2 text-center animate-in fade-in">
                      <div className="flex items-center justify-between text-xs font-medium text-[var(--text)]">
                        <span>
                          {relayState === "encrypting"
                            ? "Encrypting with client key..."
                            : "Uploading encrypted copy..."}
                        </span>
                        <span className="font-mono">{relayProgress}%</span>
                      </div>
                      <div className="w-full bg-[var(--surface)] h-2 rounded-full overflow-hidden border border-[var(--border-hairline)]">
                        <div
                          className="bg-[var(--accent)] h-full transition-all duration-300"
                          style={{ width: `${relayProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {relayState === "ready" && relayCode && (
                    <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3 text-center animate-in fade-in">
                      <span className="text-xs font-semibold text-[var(--text-muted)] block">
                        Encrypted Cloud Relay Code
                      </span>
                      <div className="text-2xl font-mono font-bold tracking-wider text-[var(--text)] select-all">
                        {relayCode}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(relayCode);
                          setCopiedRelayCode(true);
                          setTimeout(() => setCopiedRelayCode(false), 2000);
                        }}
                        className="mx-auto py-2 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedRelayCode ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedRelayCode ? "Copied!" : "Copy Code"}</span>
                      </button>
                      <p className="text-xs text-[var(--text-muted)]">
                        Receiver enters PIN {formatRoomCode(roomCode || "")}, then this relay code.
                      </p>
                    </div>
                  )}

                  {relayError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
                      {relayError}
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* STEP 2: PAIRING METHOD & LIVE QR / PIN */}
          <div className="p-6 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text)] block">
                2. Receiver Connects via QR or PIN
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                Scan QR or type the code on receiving device
              </span>
            </div>

            {/* Pairing Method Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  Pairing Key Method
                </span>
                {keyStrategy === "auto" && (
                  <button
                    type="button"
                    onClick={handleRefreshAutoPin}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>New Random PIN</span>
                  </button>
                )}
              </div>

              <SegmentedControl
                ariaLabel="Pairing Method"
                value={keyStrategy}
                onChange={(val) => handleKeyStrategyChange(val as KeyStrategy)}
                options={[
                  { value: "auto", label: "Auto PIN" },
                  { value: "phone", label: "Mobile No." },
                  { value: "keyword", label: "Keyword" },
                ]}
              />

              {/* Mobile Number Sub-Input */}
              {keyStrategy === "phone" && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] space-y-2.5 animate-in fade-in">
                  <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span>Sender Mobile Number</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSenderKey}
                      onChange={(e) => setCustomSenderKey(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyCustomKey(customSenderKey)}
                      placeholder="e.g. 01712345678"
                      className="flex-1 p-2.5 text-xs font-mono rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyCustomKey(customSenderKey)}
                      className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Set Number
                    </button>
                  </div>
                </div>
              )}

              {/* Keyword Sub-Input */}
              {keyStrategy === "keyword" && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] space-y-2.5 animate-in fade-in">
                  <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span>Custom Secret Keyword</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSenderKey}
                      onChange={(e) => setCustomSenderKey(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyCustomKey(customSenderKey)}
                      placeholder="e.g. HR998877 or LAB2026"
                      className="flex-1 p-2.5 text-xs font-mono uppercase font-bold rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyCustomKey(customSenderKey)}
                      className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Set Keyword
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* LIVE SCANNABLE QR CODE & ROOM PIN DISPLAY */}
            {roomCode ? (
              <div className="pt-2 flex flex-col items-center space-y-4">
                <QRCodeDisplay
                  code={roomCode}
                  url={
                    relayCode && roomCode
                      ? `${typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://quicksend.vercel.app"}/?room=${roomCode}#rc=${relayCode}`
                      : undefined
                  }
                />

                {/* Status Pill */}
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-mono text-[var(--text)] shadow-xs">
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
                      ? "Peer Connected! Ready to transfer."
                      : `Waiting for receiver to connect... (${formatRoomCode(roomCode)})`}
                  </span>
                </div>

                {/* Broker Notice */}
                {brokerNotice && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] font-mono">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{brokerNotice}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <RefreshCw className="w-5 h-5 text-[var(--text-muted)] animate-spin" />
                <span className="text-xs text-[var(--text-muted)]">Creating secure session...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. RECEIVER VIEW */}
      {role === "receive" && (
        <div className="space-y-6 max-w-md mx-auto">
          {!roomCode ? (
            <div className="space-y-5">
              {/* Option 1: Prominent Scan QR Button */}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                <span>Scan Sender&apos;s QR Code</span>
              </button>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[var(--border-hairline)]" />
                <span className="flex-shrink mx-4 text-[var(--text-muted)] text-xs font-mono">
                  OR ENTER CODE
                </span>
                <div className="flex-grow border-t border-[var(--border-hairline)]" />
              </div>

              {/* Option 2: Enter Room Code / PIN */}
              <div className="p-6 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3.5 text-center">
                <div className="h-10 w-10 mx-auto rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xs flex items-center justify-center text-[var(--text)]">
                  <KeyRound className="h-5 w-5" />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[var(--text)]">
                    Enter Pairing Code or PIN
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Enter 6-digit PIN, mobile number, or secret keyword
                  </p>
                </div>

                <div className="space-y-2.5">
                  <input
                    type="text"
                    maxLength={20}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && isValidRoomCode(inputCode) && handleStartReceiver()}
                    placeholder="e.g. 834-291 or 01712345678"
                    className="w-full py-3 px-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] text-center font-mono font-bold text-base tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:font-normal placeholder:tracking-normal placeholder:text-[var(--text-muted)]"
                  />

                  <button
                    type="button"
                    onClick={() => handleStartReceiver()}
                    disabled={isConnecting || !isValidRoomCode(inputCode)}
                    className="w-full py-3 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect to Sender</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center py-4">
              <div className="p-8 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col items-center gap-3.5">
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

      {/* Real-time Connection Diagnostics */}
      <ConnectionDiagnostics
        diagnostics={diagnostics}
        debugLog={debugLog}
      />

      {/* QR Scanner Camera Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScannerSuccess}
      />

      {/* Live Transfer & Acceptance Modal */}
      <TransferModal
        isOpen={isModalOpen || Boolean(relayPayload)}
        progress={enrichedProgress}
        roomCode={roomCode || inputCode}
        onAccept={acceptIncomingTransfer}
        onReject={rejectIncomingTransfer}
        onClose={handleReset}
        onRelay={() => {
          if (roomCode) {
            startRelayUpload(roomCode, selectedPayload.files, selectedPayload.text);
          }
        }}
        isRelayAvailable={Boolean(relayStatus?.available)}
        relayPayload={relayPayload}
        onDownloadRelay={(code) => downloadRelay(relayPayload!, code, roomCode || inputCode)}
        isDownloadingRelay={isDownloadingRelay}
        relayError={relayError}
      />
    </div>
  );
}
