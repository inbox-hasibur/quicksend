"use client";

import { useState, useEffect } from "react";
import {
  KeyRound,
  QrCode,
  ArrowRight,
  Camera,
  RefreshCw,
  Send,
  Download,
  AlertCircle,
  Users,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { QRScannerModal } from "@/components/QRScannerModal";
import { TransferModal } from "@/components/TransferModal";
import { useWebRTC } from "@/hooks/useWebRTC";
import { formatRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import type { InternetFormat, TransferRole } from "@/types/mode";

interface InternetSharingCardProps {
  initialRoomCode?: string;
}

export function InternetSharingCard({ initialRoomCode }: InternetSharingCardProps) {
  const isInitialReceive = Boolean(initialRoomCode && isValidRoomCode(initialRoomCode));
  const [format, setFormat] = useState<InternetFormat>("code");
  const [role, setRole] = useState<TransferRole>(isInitialReceive ? "receive" : "send");
  const [inputCode, setInputCode] = useState(initialRoomCode || "");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    role: rtcRole,
    roomCode,
    isConnected,
    progress,
    startSender,
    startReceiver,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
  } = useWebRTC();

  // Sender session start
  const handleStartSender = async () => {
    if (selectedPayload.files.length === 0 && !selectedPayload.text.trim()) {
      setErrorMsg("Please select at least one file or enter text to share.");
      return;
    }

    try {
      setIsConnecting(true);
      setErrorMsg(null);
      await startSender();
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
        sendPayload({ file: selectedPayload.files[0] }).catch((err) => {
          setErrorMsg(err.message);
        });
      } else if (selectedPayload.text.trim()) {
        sendPayload({ text: selectedPayload.text }).catch((err) => {
          setErrorMsg(err.message);
        });
      }
    }
  }, [rtcRole, isConnected, progress.status, selectedPayload, sendPayload]);

  // Receiver session start
  const handleStartReceiver = async (codeToUse?: string) => {
    const code = normalizeRoomCode(codeToUse || inputCode);
    if (!isValidRoomCode(code)) {
      setErrorMsg("Please enter a valid 6-character room code.");
      return;
    }

    try {
      setIsConnecting(true);
      setErrorMsg(null);
      await startReceiver(code);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to join room. Verify the code and try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleScannerSuccess = (scannedCode: string) => {
    setInputCode(scannedCode);
    handleStartReceiver(scannedCode);
  };

  const handleReset = () => {
    cleanup();
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Format & Role Switchers (when not in an active session) */}
      {!roomCode && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          {/* Format Picker */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-neutral-400 font-medium">Format:</span>
            <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-semibold flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setFormat("code")}
                className={`flex-1 sm:flex-initial flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  format === "code"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>6-Digit PIN</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("qr")}
                className={`flex-1 sm:flex-initial flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  format === "qr"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>QR Code</span>
              </button>
            </div>
          </div>

          {/* Role Picker */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-neutral-400 font-medium">Role:</span>
            <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-semibold flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setRole("send")}
                className={`flex-1 sm:flex-initial flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  role === "send"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("receive")}
                className={`flex-1 sm:flex-initial flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  role === "receive"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Receive</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Sender Mode View */}
      {role === "send" && (
        <div className="space-y-5">
          {!roomCode ? (
            <div className="space-y-4">
              <Dropzone onSelectionChange={setSelectedPayload} />

              <button
                type="button"
                onClick={handleStartSender}
                disabled={isConnecting}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Creating Ephemeral Room...</span>
                  </>
                ) : (
                  <>
                    <span>Generate {format === "code" ? "6-Digit PIN" : "QR Code"} &amp; Beam</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6 flex flex-col items-center">
              {/* Active Session Display */}
              <QRCodeDisplay code={roomCode} />

              {/* Peer Status */}
              <div className="flex items-center gap-2 p-3 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-mono text-neutral-600 dark:text-neutral-300">
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
                    : "Waiting for receiver to enter PIN or scan QR..."}
                </span>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 underline"
              >
                Cancel Session
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Receiver Mode View */}
      {role === "receive" && (
        <div className="space-y-5">
          {!roomCode ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <KeyRound className="h-4 w-4 text-violet-500" />
                  <span>Enter Sender&apos;s 6-Digit PIN</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={7}
                    value={inputCode}
                    onChange={(e) => setInputCode(formatRoomCode(e.target.value))}
                    placeholder="e.g. 834-291"
                    className="flex-1 p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-center font-mono font-bold text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleStartReceiver()}
                    disabled={isConnecting || !isValidRoomCode(inputCode)}
                    className="px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors disabled:opacity-40"
                  >
                    {isConnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Connect"}
                  </button>
                </div>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
                <span className="flex-shrink mx-4 text-neutral-400 text-xs uppercase font-mono">
                  Or Scan with Camera
                </span>
                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-violet-500 hover:bg-violet-50/20 text-neutral-700 dark:text-neutral-200 font-medium text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Camera className="h-4 w-4 text-violet-500" />
                <span>Open Camera QR Scanner</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col items-center gap-3">
                <Users className="h-8 w-8 text-violet-500 animate-pulse" />
                <div>
                  <h4 className="font-semibold text-sm">Connecting to Room {formatRoomCode(roomCode)}</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {isConnected ? "Connected to sender! Awaiting payload..." : "Exchanging WebRTC signaling..."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 underline"
              >
                Disconnect
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
        progress={progress}
        onAccept={acceptIncomingTransfer}
        onReject={rejectIncomingTransfer}
        onClose={handleReset}
      />
    </div>
  );
}
