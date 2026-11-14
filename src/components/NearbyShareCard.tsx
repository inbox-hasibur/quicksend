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
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { useNearbyShare } from "@/hooks/useNearbyShare";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import { ANDROID_INTENTS } from "@/lib/wifiQr";

export function NearbyShareCard() {
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
            {capabilities.hasWebShare ? "Native OS Share Ready" : "Web Share Supported"}
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

      {/* PRIMARY FLOW: 1-TAP DEVICE SHARE */}
      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-xs font-bold text-[var(--text)] block">
            1. Select Files or Text to Handoff
          </span>
          <Dropzone onSelectionChange={setSelectedPayload} />
        </div>

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
      </div>

      {/* RECEIVING GUIDANCE (PLAIN-ENGLISH & HONEST) */}
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

        <div className="pt-1 flex flex-wrap items-center gap-2">
          <a
            href={ANDROID_INTENTS.BLUETOOTH_SETTINGS}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text)] text-xs font-semibold shadow-2xs transition-colors"
          >
            <Bluetooth className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Open Android Bluetooth Settings</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
          </a>
        </div>
      </div>

      {/* SECONDARY COLLAPSIBLE: CONNECT BLE HARDWARE */}
      <div className="border border-[var(--border-hairline)] rounded-2xl overflow-hidden bg-[var(--surface)]">
        <button
          type="button"
          onClick={() => setShowBleSection(!showBleSection)}
          className="w-full p-4 flex items-center justify-between text-left text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span>Connect BLE Device (Sensors / Hardware)</span>
          </div>
          {showBleSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showBleSection && (
          <div className="p-4 sm:p-5 pt-0 border-t border-[var(--border-hairline)] space-y-4">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Connect to compatible BLE microcontrollers, Arduino/ESP32 sensor nodes, or custom hardware peripherals using the W3C Web Bluetooth GATT Client.
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
                    Opens the browser device picker to pair with nearby GATT peripherals.
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
                      <span>Pair BLE Hardware Peripheral</span>
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
