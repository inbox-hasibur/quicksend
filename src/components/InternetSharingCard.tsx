"use client";

import { useState } from "react";
import {
  KeyRound,
  Phone,
  Sparkles,
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
import type { TransferRole } from "@/types/mode";

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

    let codeToUse: string | undefined = undefined;
    if (keyStrategy === "phone" || keyStrategy === "keyword") {
      const clean = normalizeRoomCode(customSenderKey);
      if (!isValidRoomCode(clean)) {
        setErrorMsg(
          keyStrategy === "phone"
            ? "Please enter a valid mobile number (at least 6 digits)."
            : "Please enter a valid keyword between 4 and 20 characters (e.g. HR998877)."
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

  // Receiver session start
  const handleStartReceiver = async (codeToUse?: string) => {
    const code = normalizeRoomCode(codeToUse || inputCode);
    if (!isValidRoomCode(code)) {
      setErrorMsg("Please enter a valid room PIN, Mobile Number, or Keyword (4–20 characters).");
      return;
    }

    try {
      setIsConnecting(true);
      setErrorMsg(null);
      await startReceiver(code);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to join room. Verify the key and try again.");
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
      {/* 1. Header & Role Switcher */}
      {!roomCode && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              Share via Internet (Remote P2P)
            </h4>
            <p className="text-xs text-neutral-400 font-mono">End-to-End Encrypted WebRTC Relay</p>
          </div>

          {/* Role Picker (Send vs Receive) */}
          <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRole("send")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all ${
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
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all ${
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
            <div className="space-y-5">
              {/* Flexible Pairing Options Selector */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                  Choose Pairing Key Method:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setKeyStrategy("auto")}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                      keyStrategy === "auto"
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <KeyRound className="h-4 w-4 text-indigo-500" />
                    <span>Auto PIN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setKeyStrategy("phone")}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                      keyStrategy === "phone"
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <Phone className="h-4 w-4 text-emerald-500" />
                    <span>Mobile Number</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setKeyStrategy("keyword")}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                      keyStrategy === "keyword"
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Custom Keyword</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setKeyStrategy("qr")}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                      keyStrategy === "qr"
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <QrCode className="h-4 w-4 text-violet-500" />
                    <span>QR Code</span>
                  </button>
                </div>

                {/* Sub-inputs for Phone or Keyword */}
                {keyStrategy === "phone" && (
                  <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5 animate-in fade-in">
                    <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      <span>Enter Your Mobile Number</span>
                    </label>
                    <input
                      type="text"
                      value={customSenderKey}
                      onChange={(e) => setCustomSenderKey(e.target.value)}
                      placeholder="e.g. 01712345678"
                      className="w-full p-2.5 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Use a mobile number you already know by heart so you can easily type it on the receiver device.
                    </p>
                  </div>
                )}

                {keyStrategy === "keyword" && (
                  <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-1.5 animate-in fade-in">
                    <label className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Enter a Memorable Secret Keyword</span>
                    </label>
                    <input
                      type="text"
                      value={customSenderKey}
                      onChange={(e) => setCustomSenderKey(e.target.value)}
                      placeholder="e.g. HR998877 or LAB2026"
                      className="w-full p-2.5 text-xs font-mono uppercase font-bold rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Choose any unique phrase or keyword. Both you and the receiver will use this exact key to connect.
                    </p>
                  </div>
                )}
              </div>

              {/* Payload Dropzone */}
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
                    <span>Creating Ephemeral Session...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {keyStrategy === "phone"
                        ? "Beam with Mobile Number"
                        : keyStrategy === "keyword"
                        ? "Beam with Custom Keyword"
                        : "Generate Key & Beam"}
                    </span>
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
                    : `Waiting for receiver to enter "${formatRoomCode(roomCode)}" or scan QR...`}
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
              <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    <KeyRound className="h-4 w-4 text-violet-500" />
                    <span>Enter Pairing Key (PIN, Mobile Number, or Keyword)</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Type the 6-digit PIN, the sender&apos;s mobile number (e.g. 017xxxxxxxx), or their custom keyword (e.g. HR998877).
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={20}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="e.g. 834-291, 01712345678, or HR998877"
                    className="flex-1 p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-center font-mono font-bold text-base sm:text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-400"
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
                  Or Scan Camera QR
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
                  <h4 className="font-semibold text-sm">
                    Connecting to Session: &ldquo;{formatRoomCode(roomCode)}&rdquo;
                  </h4>
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
