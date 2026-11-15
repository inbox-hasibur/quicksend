"use client";

import { useState, useEffect } from "react";
import {
  Cable,
  Usb,
  Smartphone,
  ExternalLink,
  QrCode,
  AlertCircle,
  Camera,
  RefreshCw,
  Copy,
  Check,
  X,
  Cpu,
  ArrowRight,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { TransferModal } from "@/components/TransferModal";
import { QRScannerModal } from "@/components/QRScannerModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SpeedIndicator } from "@/components/SpeedIndicator";
import { useWebRTC } from "@/hooks/useWebRTC";
import { ANDROID_INTENTS } from "@/lib/wifiQr";
import { formatRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import { getPayloadBytes } from "@/lib/transferEstimate";

type CableTab = "network" | "hardware";

export function CableTransferCard() {
  const [activeTab, setActiveTab] = useState<CableTab>("network");
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });

  // Network cable state (WebRTC P2P over direct cable link)
  const [localPin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [inputCode, setInputCode] = useState("");
  const [copiedPin, setCopiedPin] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // WebUSB / Serial hardware state
  const [usbDeviceName, setUsbDeviceName] = useState<string | null>(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [baudRate, setBaudRate] = useState("115200");
  const [hardwareStatus, setHardwareStatus] = useState<string | null>(null);

  const hasUsb = typeof navigator !== "undefined" && "usb" in navigator;
  const hasSerial = typeof navigator !== "undefined" && "serial" in navigator;

  const {
    role: rtcRole,
    isConnected,
    progress,
    startSender,
    startReceiver,
    sendFiles,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
  } = useWebRTC("same-network");

  // Auto-send payload once connected
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

  const handleCopyPin = async () => {
    try {
      await navigator.clipboard.writeText(localPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleConnectPin = async (codeToUse?: string) => {
    const code = normalizeRoomCode(codeToUse || inputCode);
    if (!isValidRoomCode(code)) {
      setErrorMsg("Please enter a valid 6-digit PIN.");
      return;
    }
    setErrorMsg(null);
    setIsConnecting(true);

    try {
      const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
      if (hasPayload) {
        await startSender(code);
      } else {
        await startReceiver(code);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect via cable.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleScannerSuccess = (scanned: string) => {
    setIsScannerOpen(false);
    setInputCode(scanned);
    handleConnectPin(scanned);
  };

  const handleRequestUsb = async () => {
    setErrorMsg(null);
    try {
      if (!hasUsb) {
        setErrorMsg("WebUSB API is not supported in this browser. Use Google Chrome or Microsoft Edge.");
        return;
      }
      // @ts-expect-error WebUSB standard API
      const device = await navigator.usb.requestDevice({ filters: [] });
      if (device) {
        setUsbDeviceName(device.productName || `USB Device (${device.vendorId.toString(16)})`);
        setHardwareStatus(`Connected to ${device.productName || "USB Peripheral"} via WebUSB.`);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "NotFoundError") {
        setErrorMsg(err.message);
      }
    }
  };

  const handleRequestSerial = async () => {
    setErrorMsg(null);
    try {
      if (!hasSerial) {
        setErrorMsg("Web Serial API is not supported in this browser. Use Google Chrome or Microsoft Edge.");
        return;
      }
      // @ts-expect-error Web Serial standard API
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: parseInt(baudRate, 10) });
      setSerialConnected(true);
      setHardwareStatus(`Serial port opened at ${baudRate} baud.`);
    } catch (err) {
      if (err instanceof Error && err.name !== "NotFoundError") {
        setErrorMsg(err.message);
      }
    }
  };

  const getOrigin = () => {
    if (typeof window === "undefined") return "https://quicksend.vercel.app";
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "https://quicksend.vercel.app";
    }
    return window.location.origin;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">Via Cable</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Maximum line-speed transfer over a direct USB-C, Ethernet, or USB tethering cable.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SpeedIndicator speedBars={5} />
          <SegmentedControl
            ariaLabel="Cable Transfer Mode"
            value={activeTab}
            onChange={(val) => {
              setActiveTab(val as CableTab);
              setErrorMsg(null);
            }}
            options={[
              { value: "network", label: "Direct Cable Link" },
              { value: "hardware", label: "WebUSB & Serial" },
            ]}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: DIRECT CABLE LINK (ETHERNET / USB-C TETHERING) */}
      {activeTab === "network" ? (
        <div className="space-y-5">
          {/* Cable Setup Guidance Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent)] shrink-0 shadow-2xs">
                <Cable className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-[var(--text)]">
                  Gigabit Hardware Throughput (Up to 10 Gbps)
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Connect both devices directly using a <strong>USB-C to USB-C cable</strong> or <strong>Ethernet cable</strong>. Enable <strong>USB Tethering</strong> or link-local networking. Transfers run over direct wire at full line speed without Wi-Fi congestion or cloud bandwidth limits.
                </p>
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <a
                href={ANDROID_INTENTS.TETHER_SETTINGS}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text)] text-xs font-semibold shadow-2xs transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Open Android USB Tethering Settings</span>
                <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
              </a>
            </div>
          </div>

          {/* Payload Dropzone */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[var(--text)] block">
              1. Select Files or Text to Send
            </span>
            <Dropzone onSelectionChange={setSelectedPayload} />
            <EstimateBadge
              channel="cable"
              totalBytes={getPayloadBytes(selectedPayload.files, selectedPayload.text)}
            />
          </div>

          {/* 1-Tap Connect / Host Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Host PIN Card */}
            <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
              <span className="font-bold text-xs text-[var(--text)] block">
                Host Cable Session PIN
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">
                Share this PIN with the connected device, or scan the QR code.
              </p>
              <div className="flex items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)]">
                <span className="font-mono text-2xl font-extrabold tracking-widest text-[var(--accent)] tabular-nums">
                  {formatRoomCode(localPin)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    title="Copy PIN"
                  >
                    {copiedPin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    title="Show Session QR"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Join PIN Card */}
            <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
              <span className="font-bold text-xs text-[var(--text)] block">
                Connect to Host Cable PIN
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">
                Enter the host device&apos;s 6-digit PIN to establish the direct link.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter 6-digit PIN"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnectPin()}
                  className="flex-1 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] font-mono text-center text-xs tracking-widest uppercase focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleConnectPin()}
                  disabled={isConnecting || !inputCode.trim()}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Connect</span>}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)] text-[var(--text)] transition-colors cursor-pointer shadow-2xs"
                  title="Scan PIN QR"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: WEBUSB & SERIAL PORT (DIRECT HARDWARE) */
        <div className="space-y-5">
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-center text-indigo-500 shrink-0 shadow-2xs">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-[var(--text)]">
                  WebUSB &amp; Web Serial Hardware Port Access
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Stream data directly over a physical USB port or serial COM interface to compatible microcontrollers, Arduino, Raspberry Pi, or external USB storage peripherals.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* WebUSB Section */}
            <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center gap-2">
                <Usb className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-bold text-xs text-[var(--text)]">WebUSB Interface</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {hasUsb ? "Browser WebUSB API is supported and ready." : "WebUSB API is not available in this browser."}
              </p>

              {usbDeviceName ? (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  Connected: {usbDeviceName}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestUsb}
                  disabled={!hasUsb}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Usb className="w-3.5 h-3.5" />
                  <span>Pair USB Device</span>
                </button>
              )}
            </div>

            {/* Web Serial Section */}
            <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cable className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-xs text-[var(--text)]">Serial COM Port</span>
                </div>

                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(e.target.value)}
                  className="text-xs bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text)] rounded-lg px-2 py-1 focus:outline-none"
                  aria-label="Serial Baud Rate"
                >
                  <option value="9600">9600 baud</option>
                  <option value="57600">57600 baud</option>
                  <option value="115200">115200 baud</option>
                  <option value="921600">921600 baud</option>
                </select>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                {hasSerial ? "Browser Web Serial API is ready." : "Web Serial is not supported in this browser."}
              </p>

              {serialConnected ? (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  COM Port Open ({baudRate} baud)
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestSerial}
                  disabled={!hasSerial}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Cable className="w-3.5 h-3.5" />
                  <span>Open Serial Port</span>
                </button>
              )}
            </div>
          </div>

          {hardwareStatus && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono">
              {hardwareStatus}
            </div>
          )}
        </div>
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScannerSuccess}
      />

      {/* Session PIN QR Display Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-xs p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-xl flex flex-col items-center space-y-4">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <span className="font-bold text-sm text-[var(--text)]">Cable Session QR</span>

            <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200">
              <QRCodeSVG
                value={`${getOrigin()}/?room=${localPin}`}
                size={180}
                level="M"
              />
            </div>

            <div className="font-mono text-2xl font-extrabold tracking-widest text-[var(--accent)] tabular-nums">
              {formatRoomCode(localPin)}
            </div>

            <p className="text-[11px] text-center text-[var(--text-muted)]">
              Scan with the connected device camera to link immediately.
            </p>
          </div>
        </div>
      )}

      {/* Live WebRTC Transfer Modal */}
      <TransferModal
        progress={progress}
        onAccept={acceptIncomingTransfer}
        onReject={rejectIncomingTransfer}
        onClose={cleanup}
      />
    </div>
  );
}
