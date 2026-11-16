"use client";

import { useState } from "react";
import { Copy, Check, QrCode, Camera, RefreshCw } from "lucide-react";
import { formatRoomCode } from "@/lib/codeGenerator";

export interface DirectConnectPanelProps {
  myPin: string;
  onShowQr: () => void;
  peerPinValue: string;
  onPeerPinChange: (value: string) => void;
  onConnect: (normalizedPin: string) => void;
  onScanQr: () => void;
  isConnecting?: boolean;
  error?: string | null;
  myPinLabel?: string;
  peerPinLabel?: string;
  myPinDescription?: string;
  peerPinDescription?: string;
  scanButtonText?: string;
  className?: string;
}

export function DirectConnectPanel({
  myPin,
  onShowQr,
  peerPinValue,
  onPeerPinChange,
  onConnect,
  onScanQr,
  isConnecting = false,
  error,
  myPinLabel = "This Device PIN",
  peerPinLabel = "Connect by Peer's PIN or QR",
  myPinDescription = "Share this PIN or QR with the other device to connect directly.",
  peerPinDescription,
  scanButtonText = "Scan QR Code with Camera",
  className = "",
}: DirectConnectPanelProps) {
  const [copiedPin, setCopiedPin] = useState(false);

  const handleCopyPin = async () => {
    try {
      await navigator.clipboard.writeText(myPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  const handleConnectClick = () => {
    // Normalize typed PIN by removing spaces and dashes before invoking onConnect
    const normalized = peerPinValue.replace(/[\s-]/g, "");
    onConnect(normalized);
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 ${className}`}>
      {/* This Device's PIN & QR Display Card */}
      <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text)]">
            {myPinLabel}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
        </div>

        <div className="flex items-center justify-between gap-2 bg-[var(--surface)] p-2 px-3 rounded-xl border border-[var(--border-hairline)]">
          <span className="font-mono text-xl sm:text-2xl font-extrabold text-[var(--accent)] tracking-widest tabular-nums">
            {formatRoomCode(myPin)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyPin}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title="Copy PIN"
              aria-label="Copy PIN"
            >
              {copiedPin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onShowQr}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Show Session QR"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show QR</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[var(--text-muted)]">
          {myPinDescription}
        </p>
      </div>

      {/* Connect by Peer PIN or QR Code */}
      <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
        <span className="text-xs font-semibold text-[var(--text)] block">
          {peerPinLabel}
        </span>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter 6-digit PIN"
            value={peerPinValue}
            onChange={(e) => onPeerPinChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnectClick()}
            className="flex-1 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-xs text-[var(--text)] font-mono text-center tracking-widest uppercase focus:outline-none"
            aria-label="Peer PIN Input"
          />
          <button
            type="button"
            onClick={handleConnectClick}
            disabled={isConnecting || !peerPinValue.trim()}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
          >
            {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Connect</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={onScanQr}
          className="w-full py-2 px-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text)] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
        >
          <Camera className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{scanButtonText}</span>
        </button>

        {peerPinDescription && (
          <p className="text-[11px] text-[var(--text-muted)]">
            {peerPinDescription}
          </p>
        )}

        {error && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default DirectConnectPanel;
