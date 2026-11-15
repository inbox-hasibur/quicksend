"use client";

import { useState } from "react";
import {
  Share2,
  Bluetooth,
  Smartphone,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  ChevronDown,
  ChevronUp,
  Wifi,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { useNearbyShare } from "@/hooks/useNearbyShare";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import { ANDROID_INTENTS } from "@/lib/wifiQr";
import { getPayloadBytes } from "@/lib/transferEstimate";

interface NearbyShareCardProps {
  onOpenMode?: (modeId: string) => void;
}

export function NearbyShareCard({ onOpenMode }: NearbyShareCardProps = {}) {
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [showBleSection, setShowBleSection] = useState(false);

  const {
    capabilities,
    isSharing,
    shareSuccess,
    isConnectingBle,
    bleDevice,
    bleServices,
    errorMsg,
    shareViaNative,
    requestBleDevice,
    disconnectBleDevice,
    clearError,
  } = useNearbyShare();

  const handleTriggerShare = async () => {
    clearError();
    if (selectedPayload.files.length === 0 && !selectedPayload.text.trim()) {
      alert("Please select at least one file or enter text to share.");
      return;
    }

    const ok = await shareViaNative({
      files: selectedPayload.files.length > 0 ? selectedPayload.files : undefined,
      text: selectedPayload.text.trim() || undefined,
      title: "QuickSend Beam",
    });

    if (ok) {
      if (selectedPayload.files.length > 0) {
        for (const file of selectedPayload.files) {
          addTransferHistoryItem({
            direction: "sent",
            mode: "Nearby / Quick Share",
            itemType: "file",
            name: file.name,
            size: file.size,
            status: "completed",
          });
        }
      } else if (selectedPayload.text.trim()) {
        const text = selectedPayload.text.trim();
        addTransferHistoryItem({
          direction: "sent",
          mode: "Nearby / Quick Share",
          itemType: "text",
          name: text.length > 30 ? `${text.slice(0, 30)}...` : text,
          textSnippet: text,
          size: new Blob([text]).size,
          status: "completed",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">
            Bluetooth &amp; Quick Share
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Proximity file sharing using your operating system&apos;s native share engine
          </p>
        </div>

        {/* OS Share Status Badge */}
        <div className="flex items-center gap-2 bg-[var(--surface-subtle)] px-3 py-1.5 rounded-2xl border border-[var(--border-hairline)] text-xs">
          <Share2 className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="font-medium text-[var(--text)]">
            {capabilities.hasWebShare ? "Native OS Share Ready" : "Web Share Unsupported"}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Banner */}
      {shareSuccess && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Payload handed off to Native OS Share Sheet successfully!</span>
        </div>
      )}

      {/* 1. SELECT FILES & NATIVE SHARE */}
      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-xs font-bold text-[var(--text)] block">
            1. Select Files or Text to Handoff
          </span>
          <Dropzone onSelectionChange={setSelectedPayload} />
          <EstimateBadge
            channel="bluetooth"
            totalBytes={getPayloadBytes(selectedPayload.files, selectedPayload.text)}
          />
        </div>

        {!capabilities.hasWebShare ? (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Native Web Share is not supported in this browser. To send files to nearby devices without restrictions, switch to <strong>Wi-Fi Hotspot</strong> or <strong>Same Wi-Fi</strong> mode.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleTriggerShare}
            disabled={isSharing}
            className="w-full py-3.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSharing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Opening Native Share Sheet...</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span>Send via Quick Share / AirDrop / Bluetooth</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 2. RECEIVING GUIDANCE */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent)] shrink-0 shadow-2xs">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-[var(--text)]">
              How Receiving Works on this Device
            </h4>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Browsers cannot directly intercept incoming Bluetooth radio packets due to web security sandbox boundaries. To receive files, make sure <strong>Quick Share</strong> (Android/Windows), <strong>AirDrop</strong> (Apple), or <strong>Bluetooth File Receiving</strong> is turned ON in your operating system settings. Files sent to this device will appear directly in your Downloads or Notifications.
            </p>
          </div>
        </div>
      </div>

      {/* 3. NEUTRAL INFO BOX & RADAR ALTERNATIVES */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Browsers cannot scan or pair with other phones over Bluetooth. Quick Share and AirDrop do the nearby discovery for you. To send without internet, use Wi-Fi Hotspot mode.
        </p>
        <div className="pt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenMode?.("hotspot")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text)] text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Open Wi-Fi Hotspot mode</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenMode?.("same-network")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text)] text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Wifi className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Open Same Wi-Fi mode</span>
          </button>
        </div>
      </div>

      {/* 4. BLUETOOTH SETTINGS BUTTON */}
      <div>
        <a
          href={ANDROID_INTENTS.BLUETOOTH_SETTINGS}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text)] text-xs font-semibold shadow-2xs transition-colors"
        >
          <Bluetooth className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Open Bluetooth settings</span>
          <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
        </a>
      </div>

      {/* 5. COLLAPSIBLE BLE HARDWARE SECTION */}
      <div className="border border-[var(--border-hairline)] rounded-2xl overflow-hidden bg-[var(--surface)]">
        <button
          type="button"
          onClick={() => setShowBleSection(!showBleSection)}
          className="w-full p-4 flex items-center justify-between text-left text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span>BLE hardware (sensors, microcontrollers)</span>
          </div>
          {showBleSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showBleSection && (
          <div className="p-4 sm:p-5 pt-0 border-t border-[var(--border-hairline)] space-y-4">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Connect to compatible BLE microcontrollers, Arduino/ESP32 sensor nodes, or custom hardware peripherals using the W3C Web Bluetooth GATT Client.
            </p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium">
              Phones will not appear here. Only devices that advertise over BLE are listed.
            </p>

            {!capabilities.hasBluetooth ? (
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] space-y-1">
                <span className="font-semibold text-[var(--text)] block">
                  Web Bluetooth API Unsupported
                </span>
                <p>
                  Your current browser does not support the Web Bluetooth API. Use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on Android/Desktop to connect directly to BLE peripheral hardware.
                </p>
              </div>
            ) : !bleDevice ? (
              <div className="p-5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xs text-[var(--accent)] flex items-center justify-center mx-auto">
                  <Bluetooth className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[var(--text)]">
                    Scan for Nearby BLE Peripherals
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Opens the browser device picker to select nearby GATT peripherals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestBleDevice}
                  disabled={isConnectingBle}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isConnectingBle ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Choose BLE device</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-[var(--text)]">{bleDevice.name || "BLE Device"}</h4>
                    <p className="text-[10px] font-mono text-[var(--text-muted)]">
                      ID: {bleDevice.id.slice(0, 14)}... • Status:{" "}
                      <span className={bleDevice.connected ? "text-emerald-500 font-bold" : "text-neutral-400"}>
                        {bleDevice.connected ? "Connected" : "Disconnected"}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={disconnectBleDevice}
                    className="px-3 py-1 rounded-full border border-[var(--border-hairline)] hover:bg-[var(--surface)] text-xs font-semibold text-[var(--text)] transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>

                {bleServices.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border-hairline)]">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                      Discovered GATT Services ({bleServices.length})
                    </span>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {bleServices.map((srv, idx) => (
                        <div
                          key={`${srv.uuid}-${idx}`}
                          className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-mono"
                        >
                          <div className="text-indigo-600 dark:text-indigo-400 font-bold truncate">
                            {srv.uuid}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {srv.characteristics.length} Characteristic(s)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
