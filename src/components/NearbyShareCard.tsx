"use client";

import React, { useState } from "react";
import {
  Bluetooth,
  Share2,
  RefreshCw,
  Check,
  AlertCircle,
  ExternalLink,
  Smartphone,
  Cpu,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { useNearbyShare } from "@/hooks/useNearbyShare";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import { ANDROID_INTENTS } from "@/lib/wifiQr";
import { getPayloadBytes } from "@/lib/transferEstimate";

export function NearbyShareCard() {
  const [payload, setPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });

  const {
    capabilities,
    isSharing,
    shareSuccess,
    shareViaNative,
    isConnectingBle,
    bleDevice,
    bleServices,
    errorMsg: nativeErrorMsg,
    clearError: clearNativeError,
    requestBleDevice,
    disconnectBleDevice: disconnectBle,
  } = useNearbyShare();

  const handleTriggerNativeShare = async () => {
    clearNativeError();
    if (payload.files.length === 0 && !payload.text.trim()) {
      return;
    }

    const ok = await shareViaNative({
      files: payload.files.length > 0 ? payload.files : undefined,
      text: payload.text.trim() || undefined,
      title: "QuickSend Transfer",
    });

    if (ok) {
      if (payload.files.length > 0) {
        for (const file of payload.files) {
          addTransferHistoryItem({
            direction: "sent",
            mode: "Bluetooth",
            itemType: "file",
            name: file.name,
            size: file.size,
            status: "completed",
          });
        }
      } else if (payload.text.trim()) {
        const text = payload.text.trim();
        addTransferHistoryItem({
          direction: "sent",
          mode: "Bluetooth",
          itemType: "text",
          name: text.length > 30 ? `${text.slice(0, 30)}...` : text,
          textSnippet: text,
          size: new Blob([text]).size,
          status: "completed",
        });
      }
    }
  };

  const hasPayload = payload.files.length > 0 || payload.text.trim().length > 0;
  const totalBytes = getPayloadBytes(payload.files, payload.text);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">Bluetooth</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Send via system Bluetooth, Quick Share, or AirDrop
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 bg-[var(--surface-subtle)] px-3 py-1.5 rounded-2xl border border-[var(--border-hairline)] text-xs">
          <Bluetooth className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="font-medium text-[var(--text)]">Direct Radio / Share</span>
        </div>
      </div>

      {/* Notifications */}
      {nativeErrorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{nativeErrorMsg}</span>
        </div>
      )}

      {shareSuccess && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Payload handed off to Native OS Share Sheet successfully!</span>
        </div>
      )}

      {/* Main Send Workspace */}
      <div className="space-y-4">
        {/* Step 1: Attach files or text */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[var(--text)] block">
            Step 1: Attach Files or Text
          </span>
          <Dropzone onSelectionChange={setPayload} />
          <div className="flex justify-center">
            <EstimateBadge channel="bluetooth" totalBytes={totalBytes} />
          </div>
        </div>

        {/* Step 2: Primary Send Button */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-bold text-[var(--text)] block">
            Step 2: Share via OS Radio
          </span>

          {!capabilities.hasWebShare ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Native Web Share is not supported in this browser. To send files to nearby devices
                without restrictions, switch to <strong>Wi-Fi Hotspot</strong> or <strong>Same Wi-Fi</strong> mode.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleTriggerNativeShare}
              disabled={isSharing || !hasPayload}
              className="w-full py-3.5 px-6 rounded-2xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSharing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Opening Share Sheet...</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  <span>Send via Bluetooth / Quick Share / AirDrop</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Clear Honest Info Card */}
      <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent)] shrink-0 shadow-2xs">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-xs text-[var(--text)]">
              How Receiving Works via Bluetooth
            </h4>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Web browsers cannot directly exchange files between two browser tabs over raw Bluetooth radio due to web sandbox security boundaries.
            </p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              To receive files over Bluetooth, make sure <strong>Bluetooth</strong>, <strong>Quick Share</strong> (Android/Windows), or <strong>AirDrop</strong> (Apple) is enabled in your device settings. For direct browser-to-browser offline transfers, use <strong>Wi-Fi Hotspot</strong>.
            </p>
          </div>
        </div>

        <div className="pt-1">
          <a
            href={ANDROID_INTENTS.BLUETOOTH_SETTINGS}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text)] text-xs font-semibold shadow-2xs transition-colors"
          >
            <span>Open Bluetooth settings</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
          </a>
        </div>
      </div>

      {/* Optional Collapsible BLE Hardware Section */}
      <details className="border border-[var(--border-hairline)] rounded-2xl overflow-hidden bg-[var(--surface-subtle)] text-xs group">
        <summary className="p-3.5 font-semibold text-[var(--text)] cursor-pointer hover:bg-[var(--surface)] transition-colors select-none flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--text-muted)]" />
            Connect BLE Hardware (Sensors)
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">Web Bluetooth</span>
        </summary>

        <div className="p-4 border-t border-[var(--border-hairline)] space-y-3 bg-[var(--surface)]">
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            Connect to nearby Bluetooth Low Energy (BLE) peripherals, heart rate monitors, microcontrollers, and IoT devices via the W3C Web Bluetooth API (<code className="font-mono">navigator.bluetooth</code>).
          </p>

          {!capabilities.hasBluetooth ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
              Web Bluetooth is not supported in this browser. Use Chrome or Edge on Android, Windows, ChromeOS, or macOS.
            </div>
          ) : bleDevice ? (
            <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[var(--text)] block">
                    {bleDevice.name || "Unnamed BLE Device"}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    ID: {bleDevice.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={disconnectBle}
                  className="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {bleServices.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Discovered GATT Services ({bleServices.length})
                  </span>
                  <div className="space-y-1">
                    {bleServices.map((svc) => (
                      <div key={svc.uuid} className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] font-mono text-[10px] text-[var(--text-muted)]">
                        {svc.uuid} ({svc.characteristics.length} chars)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={requestBleDevice}
              disabled={isConnectingBle}
              className="px-4 py-2 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text)] font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isConnectingBle ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Scanning for BLE Devices...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="h-3.5 w-3.5" />
                  <span>Scan for BLE Device</span>
                </>
              )}
            </button>
          )}
        </div>
      </details>
    </div>
  );
}
