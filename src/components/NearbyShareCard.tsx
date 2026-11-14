"use client";

import { useState } from "react";
import {
  Share2,
  Bluetooth,
  Smartphone,
  ExternalLink,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  Radio,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useNearbyShare } from "@/hooks/useNearbyShare";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import { ANDROID_INTENTS } from "@/lib/wifiQr";

type NearbyTab = "quickshare" | "ble" | "guide";

export function NearbyShareCard() {
  const [activeTab, setActiveTab] = useState<NearbyTab>("quickshare");
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });

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
      {/* 1. Header & Segmented Pill Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
            Bluetooth &amp; Quick Share
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Native OS Bluetooth, AirDrop &amp; Quick Share
          </p>
        </div>

        {/* Segmented Pill Selector */}
        <SegmentedControl
          ariaLabel="Nearby Mode"
          value={activeTab}
          onChange={(val) => {
            setActiveTab(val as NearbyTab);
            clearError();
          }}
          options={[
            { value: "quickshare", label: "Quick Share" },
            { value: "ble", label: "BLE Client" },
            { value: "guide", label: "Guide" },
          ]}
        />
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

      {/* TAB 1: QUICK SHARE (NATIVE OS PROXIMITY) */}
      {activeTab === "quickshare" && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-start gap-3 text-xs text-[var(--text)]">
            <Radio className="h-4 w-4 text-neutral-600 dark:text-neutral-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Seamless OS Proximity Handoff: </span>
              Uses your operating system&apos;s native share sheet. Automatically leverages{" "}
              <strong>Android Quick Share / Nearby Share</strong>,{" "}
              <strong>Apple AirDrop</strong>, or <strong>Windows Bluetooth File Transfer</strong> for zero-login transfer.
            </div>
          </div>

          {!capabilities.hasWebShare && (
            <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-start gap-2.5 text-xs text-[var(--text)]">
              <Info className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <p>
                Native Web Share is not supported in this browser. To send files to nearby devices without restrictions, switch to <strong>Mode 1 (Via Internet)</strong> or <strong>Mode 2 (Same Wi-Fi)</strong>.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block px-1">
              Select Files or Text to Handoff
            </span>
            <Dropzone onSelectionChange={setSelectedPayload} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={handleTriggerShare}
              disabled={isSharing}
              className="flex-1 py-3 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSharing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Opening Native Share Sheet...</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  <span>Beam via Quick Share / AirDrop</span>
                </>
              )}
            </button>

            <a
              href={ANDROID_INTENTS.BLUETOOTH_SETTINGS}
              className="py-3 px-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-neutral-200/60 dark:hover:bg-neutral-750 text-[var(--text)] font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs"
            >
              <Smartphone className="h-4 w-4" />
              <span>Android Bluetooth Settings</span>
              <ExternalLink className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </a>
          </div>
        </div>
      )}

      {/* TAB 2: BLE GATT CLIENT (PERIPHERAL HARDWARE) */}
      {activeTab === "ble" && (
        <div className="space-y-6">
          <div className="p-4 sm:p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800 flex items-start gap-3.5 text-xs text-neutral-700 dark:text-neutral-300">
            <Cpu className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Web Bluetooth GATT Client: </span>
              Connect to compatible BLE microcontrollers, Arduino/ESP32 data loggers, fitness devices, or custom hardware peripherals directly from your browser.
            </div>
          </div>

          {!capabilities.hasBluetooth ? (
            <div className="p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center space-y-4 max-w-md mx-auto">
              <div className="h-11 w-11 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs text-amber-500 flex items-center justify-center mx-auto">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[var(--text)]">
                  Web Bluetooth Unavailable
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Your current browser (such as iOS Safari or Firefox) restricts Web Bluetooth APIs.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-800 border border-[var(--border-hairline)] text-left text-xs text-[var(--text-muted)] space-y-2">
                <span className="font-semibold text-[var(--text)] block">
                  Recommended Alternatives:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    Switch to <strong>Mode 1 (Via Internet)</strong> or <strong>Mode 3 (Wi-Fi Hotspot)</strong> for fast camera QR transfers that work on all browsers.
                  </li>
                  <li>
                    Open QuickSend in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on desktop/Android for native Bluetooth peripheral access.
                  </li>
                </ul>
              </div>
            </div>
          ) : !bleDevice ? (
            <div className="p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center space-y-4 max-w-md mx-auto">
              <div className="h-11 w-11 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs text-neutral-800 dark:text-neutral-200 flex items-center justify-center mx-auto">
                <Bluetooth className="h-5 w-5" />
              </div>

              <div>
                <h4 className="font-bold text-sm text-[var(--text)]">
                  Scan for Nearby BLE Peripherals
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Click below to open the browser&apos;s Bluetooth device picker.
                </p>
              </div>

              <button
                type="button"
                onClick={requestBleDevice}
                disabled={isConnectingBle}
                className="w-full py-3 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isConnectingBle ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Connecting to Peripheral...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Pair BLE Hardware Peripheral</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs flex items-center justify-center text-neutral-800 dark:text-neutral-200">
                    <Bluetooth className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text)]">
                      {bleDevice.name}
                    </h4>
                    <p className="text-[11px] font-mono text-[var(--text-muted)]">
                      ID: {bleDevice.id.slice(0, 12)}... • Status:{" "}
                      <span className={bleDevice.connected ? "text-emerald-500 font-bold" : "text-neutral-400"}>
                        {bleDevice.connected ? "Connected" : "Disconnected"}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={disconnectBleDevice}
                  className="px-3.5 py-1.5 rounded-full border border-[var(--border-hairline)] hover:bg-white dark:hover:bg-neutral-800 text-xs font-semibold text-[var(--text)] transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>

              {bleServices.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                    Discovered GATT Services ({bleServices.length})
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {bleServices.map((srv, idx) => (
                      <div
                        key={`${srv.uuid}-${idx}`}
                        className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 text-xs font-mono"
                      >
                        <div className="text-indigo-600 dark:text-indigo-400 font-bold truncate">
                          {srv.uuid}
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">
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

      {/* TAB 3: BROWSER SECURITY & CAPABILITY GUIDE */}
      {activeTab === "guide" && (
        <div className="space-y-4 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800 space-y-3">
            <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-500" />
              <span>Why Browser-to-Browser Direct BLE Transfer is Restricted</span>
            </h4>
            <p>
              Under W3C Web Bluetooth specifications, web browsers can only act as a{" "}
              <strong className="text-neutral-900 dark:text-neutral-100">GATT Central (Client)</strong>.
              Browsers are intentionally forbidden from acting as a <em>GATT Peripheral or Server</em> for device security and anti-tracking reasons.
            </p>
            <p>
              Therefore, direct web-page-to-web-page Bluetooth file transfer is impossible in pure web standards. To solve this honestly:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Mode 4 Tier 1 (Quick Share / AirDrop):</strong> Employs <code>navigator.share</code> with file payloads to trigger the OS-level proximity system (Quick Share, AirDrop, Bluetooth File Transfer).
              </li>
              <li>
                <strong>Mode 1, 2, &amp; 3 (WebRTC P2P):</strong> Use WebRTC DataChannels over Internet, local Wi-Fi, or Hotspots with optical camera QR handshakes for high-speed device-to-device transfers.
              </li>
              <li>
                <strong>Mode 4 Tier 2 (GATT Client):</strong> Connects directly to external BLE hardware peripherals (ESP32, microcontrollers, medical/fitness loggers).
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
            <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 flex items-center justify-between">
              <span>Web Share API Support:</span>
              <span className={capabilities.hasWebShare ? "text-emerald-500 font-bold" : "text-amber-500"}>
                {capabilities.hasWebShare ? "Supported" : "Unsupported"}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 flex items-center justify-between">
              <span>Web Bluetooth API Support:</span>
              <span className={capabilities.hasBluetooth ? "text-emerald-500 font-bold" : "text-amber-500"}>
                {capabilities.hasBluetooth ? "Supported" : "Unsupported"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
