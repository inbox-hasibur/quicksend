"use client";

import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { DirectConnectPanel } from "@/components/DirectConnectPanel";
import { ConnectionDiagnostics } from "@/components/ConnectionDiagnostics";
import { formatRoomCode } from "@/lib/codeGenerator";
import type { DiscoveryStatus } from "@/hooks/useLocalDiscovery";
import type { WebRTCDiagnostics, DebugLogEntry } from "@/hooks/useWebRTC";

export interface LanDirectFallbackProps {
  nearbyCode: string;
  onNearbyCodeChange: (code: string) => void;
  localDevicePin: string;
  manualCode: string;
  onManualCodeChange: (code: string) => void;
  onConnect: (pin?: string) => void;
  onStartReceiver: (pin: string) => void;
  onScanQr: () => void;
  onBackToRadar: () => void;
  diagnostics: WebRTCDiagnostics;
  debugLog: DebugLogEntry[];
  discoveryStatus: DiscoveryStatus;
}

export function LanDirectFallback({
  nearbyCode,
  onNearbyCodeChange,
  localDevicePin,
  manualCode,
  onManualCodeChange,
  onConnect,
  onStartReceiver,
  onScanQr,
  onBackToRadar,
  diagnostics,
  debugLog,
  discoveryStatus,
}: LanDirectFallbackProps) {
  const [isShowQrModalOpen, setIsShowQrModalOpen] = useState(false);

  const handleOpenQr = () => {
    setIsShowQrModalOpen(true);
    onStartReceiver(localDevicePin);
  };

  return (
    <div className="space-y-4 rounded-3xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] p-5 animate-in fade-in">
      {/* Top Bar with Back to Radar */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
        <div>
          <h4 className="font-bold text-xs text-[var(--text)]">Direct PIN & QR Connect</h4>
          <p className="text-[11px] text-[var(--text-muted)]">
            Connect across subnets or when devices aren&apos;t appearing on radar
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToRadar}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--accent)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Radar</span>
        </button>
      </div>

      {/* Option 1: 4-digit nearby grouping code */}
      <div className="space-y-2 p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)]">
        <span className="font-semibold text-xs text-[var(--text)] block">
          Option 1: Subnet / CGNAT Pairing Code
        </span>
        <p className="text-[11px] text-[var(--text-muted)]">
          Enter the same 4 digits on both devices to bridge separate router subnets:
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="4-digit code"
            value={nearbyCode}
            onChange={(e) => onNearbyCodeChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-32 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-sm font-mono font-bold text-center text-[var(--text)] focus:outline-none"
            aria-label="Nearby 4-digit pairing code"
          />
          <button
            type="button"
            onClick={() => onNearbyCodeChange(Math.floor(1000 + Math.random() * 9000).toString())}
            className="px-3 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] hover:text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer"
          >
            Generate
          </button>
          {nearbyCode && (
            <button
              type="button"
              onClick={() => onNearbyCodeChange("")}
              className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Option 2: 6-digit PIN & QR panel */}
      <div className="space-y-2">
        <span className="font-semibold text-xs text-[var(--text)] block">
          Option 2: 6-Digit PIN or Camera QR
        </span>
        <DirectConnectPanel
          myPin={localDevicePin}
          onShowQr={handleOpenQr}
          peerPinValue={manualCode}
          onPeerPinChange={onManualCodeChange}
          onConnect={onConnect}
          onScanQr={onScanQr}
        />
      </div>

      {/* Advanced diagnostics hidden inside details */}
      <details className="pt-2 text-xs text-[var(--text-muted)] group">
        <summary className="font-medium text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer select-none">
          Advanced Network Diagnostics
        </summary>
        <div className="pt-3">
          <ConnectionDiagnostics
            diagnostics={diagnostics}
            debugLog={debugLog}
            discoveryStatus={discoveryStatus}
          />
        </div>
      </details>

      {/* Direct Room QR Modal */}
      {isShowQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
              <span className="font-bold text-sm text-[var(--text)]">Direct Wi-Fi Room QR</span>
              <button
                type="button"
                onClick={() => setIsShowQrModalOpen(false)}
                className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[var(--border-hairline)] inline-block mx-auto shadow-sm">
              <QRCodeSVG
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/?room=${localDevicePin}`
                    : `https://quicksend.vercel.app/?room=${localDevicePin}`
                }
                size={200}
                level="M"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-[var(--text-muted)]">Room PIN</p>
              <p className="font-mono text-2xl font-black text-[var(--text)] tracking-widest">
                {formatRoomCode(localDevicePin)}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Scan with any camera or enter PIN in QuickSend
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsShowQrModalOpen(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
