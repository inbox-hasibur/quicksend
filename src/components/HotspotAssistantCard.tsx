"use client";

import { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Wifi,
  ExternalLink,
  QrCode,
  Radio,
  Send,
  AlertCircle,
  Sparkles,
  Camera,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  Check,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { TransferModal } from "@/components/TransferModal";
import { QRScannerModal } from "@/components/QRScannerModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useLocalDiscovery, type NearbyPeer } from "@/hooks/useLocalDiscovery";
import { buildWifiQrString, ANDROID_INTENTS } from "@/lib/wifiQr";
import { formatRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import { getPayloadBytes } from "@/lib/transferEstimate";

type HotspotSetupTab = "host" | "join";

function generateHotspotSessionCode(): string {
  return `hot${Math.floor(100000 + Math.random() * 900000)}`;
}

export function HotspotAssistantCard() {
  const [setupTab, setSetupTab] = useState<HotspotSetupTab>("host");
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [targetPeer, setTargetPeer] = useState<NearbyPeer | null>(null);

  // Optional Wi-Fi QR Generator
  const [showWifiQr, setShowWifiQr] = useState(false);
  const [ssid, setSsid] = useState("QuickSend-Hotspot");
  const [password, setPassword] = useState("12345678");

  // Offline Direct PIN / Optical Pairing Fallback
  const [isOfflineBackupOpen, setIsOfflineBackupOpen] = useState(false);
  const [localDevicePin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [manualCode, setManualCode] = useState("");
  const [isShowPinQrModalOpen, setIsShowPinQrModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isConnectingManual, setIsConnectingManual] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real Working Discovery Engine over Hotspot Subnet
  const {
    profile,
    peers,
    incomingBeam,
    beamToPeer,
    clearIncomingBeam,
    cycleAvatar,
  } = useLocalDiscovery(true);

  // WebRTC DataChannel Engine
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
  } = useWebRTC("hotspot");

  const processedBeamCodeRef = useRef<string | null>(null);

  // Auto-join incoming beam when beamed by another device on the hotspot
  useEffect(() => {
    if (
      incomingBeam &&
      !isConnected &&
      progress.status === "idle" &&
      processedBeamCodeRef.current !== incomingBeam.roomCode
    ) {
      processedBeamCodeRef.current = incomingBeam.roomCode;
      clearIncomingBeam();
      startReceiver(incomingBeam.roomCode).catch(() => {});
    }
  }, [incomingBeam, isConnected, progress.status, clearIncomingBeam, startReceiver]);

  // Transmit payload once connection is established
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

  const handleModalClose = () => {
    cleanup();
    setTargetPeer(null);
    setErrorMsg(null);
    clearIncomingBeam().catch(() => {});
  };

  const handleSendToPeer = async (peer: NearbyPeer) => {
    setTargetPeer(peer);
    setErrorMsg(null);

    const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
    if (!hasPayload) {
      return;
    }

    try {
      const sessionCode = generateHotspotSessionCode();
      await startSender(sessionCode);
      await beamToPeer(peer.id, sessionCode);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect to target device.");
    }
  };

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let generated = "";
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const wifiQrString = buildWifiQrString({
    ssid,
    password,
    encryption: password ? "WPA" : "nopass",
  });

  const getDeviceIcon = (formFactor: string, className = "w-5 h-5") => {
    switch (formFactor) {
      case "mobile":
        return <Smartphone className={className} />;
      case "tablet":
        return <Tablet className={className} />;
      case "desktop":
        return <Monitor className={className} />;
      default:
        return <Laptop className={className} />;
    }
  };

  const handleCopyPin = async () => {
    try {
      await navigator.clipboard.writeText(localDevicePin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // Ignore copy error
    }
  };

  const handleManualConnect = async () => {
    const clean = normalizeRoomCode(manualCode);
    if (!isValidRoomCode(clean)) {
      setErrorMsg("Please enter a valid 6-digit PIN.");
      return;
    }
    setErrorMsg(null);
    setIsConnectingManual(true);
    try {
      const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
      if (hasPayload) {
        await startSender(clean);
      } else {
        await startReceiver(clean);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect via PIN.");
    } finally {
      setIsConnectingManual(false);
    }
  };

  const handleScannerSuccess = async (scannedCode: string) => {
    setIsScannerOpen(false);
    setManualCode(scannedCode);
    const clean = normalizeRoomCode(scannedCode);
    if (!isValidRoomCode(clean)) return;

    setErrorMsg(null);
    try {
      const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
      if (hasPayload) {
        await startSender(clean);
      } else {
        await startReceiver(clean);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect via QR code.");
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
      {/* Header & Local Device Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">Wi-Fi Hotspot</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Direct transfer over a mobile hotspot or Wi-Fi AP. Connect both devices to the same hotspot and tap to beam.
          </p>
        </div>

        {/* Local Device Identity Badge */}
        <div className="flex items-center gap-2 bg-[var(--surface-subtle)] px-3 py-1.5 rounded-2xl border border-[var(--border-hairline)]">
          <div className="text-[var(--accent)]">{getDeviceIcon(profile.formFactor, "w-4 h-4")}</div>
          <span className="text-xs font-medium text-[var(--text)] truncate max-w-[140px]">
            {profile.codename || profile.name}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            (You)
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: COMPACT HOTSPOT SETUP WITH 1-TAP OS SHORTCUTS */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text)]">
            <Radio className="h-4 w-4 text-[var(--accent)]" />
            <span>Step 1: Connect Devices to Hotspot</span>
          </div>

          <SegmentedControl
            ariaLabel="Hotspot Setup Role"
            value={setupTab}
            onChange={(val) => setSetupTab(val as HotspotSetupTab)}
            options={[
              { value: "host", label: "Host Hotspot" },
              { value: "join", label: "Join Hotspot" },
            ]}
          />
        </div>

        {setupTab === "host" ? (
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Turn on your phone or laptop&apos;s Mobile Hotspot. Other devices can join via your Wi-Fi name or QR code.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={ANDROID_INTENTS.TETHER_SETTINGS}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] font-semibold text-xs hover:bg-[var(--surface-subtle)] transition-colors shadow-2xs"
                >
                  <Radio className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>Android Hotspot Settings</span>
                  <ExternalLink className="h-3 w-3 text-[var(--text-muted)]" />
                </a>

                <button
                  type="button"
                  onClick={() => setShowWifiQr(!showWifiQr)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] font-semibold text-xs hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer shadow-2xs"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{showWifiQr ? "Hide QR" : "Show Wi-Fi QR"}</span>
                </button>
              </div>
            </div>

            {/* Optional Collapsible Wi-Fi QR Generator */}
            {showWifiQr && (
              <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                      Hotspot Name (SSID)
                    </label>
                    <input
                      type="text"
                      value={ssid}
                      onChange={(e) => setSsid(e.target.value)}
                      className="w-full p-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs font-mono text-[var(--text)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Generate</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs font-mono text-[var(--text)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                  <div className="p-3 bg-white rounded-xl shadow-2xs border border-neutral-200">
                    <QRCodeSVG value={wifiQrString} size={130} level="M" />
                  </div>
                  <div className="text-xs text-[var(--text-muted)] space-y-1">
                    <p className="font-semibold text-[var(--text)]">Instant 1-Scan Hotspot Join</p>
                    <p className="text-[11px] leading-relaxed">
                      Point any iPhone, Android, or laptop camera at this QR code to join your hotspot without manually typing the password.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Connect this device to the host&apos;s Wi-Fi Hotspot. Once connected, both devices will see each other on the radar below.
            </p>
            <a
              href={ANDROID_INTENTS.WIFI_SETTINGS}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] font-semibold text-xs hover:bg-[var(--surface-subtle)] transition-colors shadow-2xs shrink-0"
            >
              <Wifi className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Open Android Wi-Fi Settings</span>
              <ExternalLink className="h-3 w-3 text-[var(--text-muted)]" />
            </a>
          </div>
        )}
      </div>

      {/* STEP 2: FILE SELECTION & PAYLOAD DROPZONE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-[var(--text)]">
            Step 2: Select Files or Text to Send
          </label>
          {targetPeer && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text)] shadow-2xs">
              <span className="text-base">{targetPeer.avatarEmoji}</span>
              <span>Ready to send to {targetPeer.codename || targetPeer.name}</span>
            </span>
          )}
        </div>
        <Dropzone
          onSelectionChange={(payload: { files: File[]; text: string }) => {
            setSelectedPayload(payload);
            setErrorMsg(null);
          }}
        />
        <EstimateBadge
          channel="hotspot"
          totalBytes={getPayloadBytes(selectedPayload.files, selectedPayload.text)}
        />
        {targetPeer && (selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0) && (
          <button
            type="button"
            onClick={() => handleSendToPeer(targetPeer)}
            className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <span>Send to {targetPeer.avatarEmoji} {targetPeer.codename || targetPeer.name}</span>
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* STEP 3: LIVE HOTSPOT RADAR DISCOVERY SCREEN */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--text)]">
            Devices on this Hotspot ({peers.length})
          </label>
          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{peers.length > 0 ? "Hotspot Subnet Synced" : "Scanning hotspot..."}</span>
          </span>
        </div>

        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] min-h-[300px] max-h-[420px] bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-3xl overflow-hidden flex items-center justify-center p-6 shadow-inner">
          {/* Radar Concentric Rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[180px] sm:w-[220px] h-[180px] sm:h-[220px] rounded-full border border-neutral-300/80 dark:border-neutral-700/60" />
            <div className="absolute w-[290px] sm:w-[350px] h-[290px] sm:h-[350px] rounded-full border border-neutral-300/50 dark:border-neutral-700/40" />
            <div className="absolute w-[400px] sm:w-[480px] h-[400px] sm:h-[480px] rounded-full border border-neutral-300/30 dark:border-neutral-700/20" />
          </div>

          {/* Sweeping Radar Scanner Line */}
          <div className="absolute w-[400px] sm:w-[480px] h-[400px] sm:h-[480px] rounded-full pointer-events-none animate-radar-sweep overflow-hidden">
            <div
              className="w-1/2 h-1/2 origin-bottom-right"
              style={{
                background:
                  "conic-gradient(from 0deg at 100% 100%, rgba(99, 102, 241, 0.22) 0deg, transparent 70deg)",
              }}
            />
          </div>

          {/* Center Node (This Device) */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-14 h-14 rounded-full bg-[var(--accent)]/15 animate-radar-ping pointer-events-none" />
              <button
                type="button"
                onClick={cycleAvatar}
                title="Tap to change your avatar"
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md text-white border-2 border-white dark:border-neutral-800 text-2xl select-none hover:scale-110 active:scale-95 transition-all cursor-pointer group"
                style={{ backgroundColor: profile.avatarColor }}
              >
                <span className="group-hover:rotate-12 transition-transform">{profile.avatarEmoji || "🦊"}</span>
              </button>
            </div>
            <div className="mt-2">
              <span className="text-xs font-bold text-[var(--text)] block truncate max-w-[140px]">
                {profile.codename}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
                You ({profile.os} • {profile.browser})
              </span>
              <button
                type="button"
                onClick={cycleAvatar}
                className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer mt-0.5"
              >
                Change avatar
              </button>
            </div>
          </div>

          {/* Discovered Nearby Hotspot Devices */}
          {peers.length > 0 ? (
            <div className="absolute inset-0 p-4 sm:p-6 pointer-events-none flex flex-wrap items-center justify-around gap-4">
              {peers.map((peer, idx) => {
                const isSelected = targetPeer?.id === peer.id;
                return (
                  <button
                    key={peer.id}
                    onClick={() => handleSendToPeer(peer)}
                    className={`pointer-events-auto group relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 ${
                      isSelected
                        ? "bg-[var(--accent)] text-[var(--surface)] border-[var(--accent)] shadow-md"
                        : "bg-[var(--surface)] text-[var(--text)] border-[var(--border-hairline)] hover:border-neutral-400 dark:hover:border-neutral-600"
                    }`}
                    style={{
                      transform: `rotate(${idx * 75}deg) translateY(-85px) rotate(-${idx * 75}deg)`,
                    }}
                    title={`Send payload to ${peer.codename || peer.name}`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xl select-none shrink-0 shadow-xs border border-white/20 text-white"
                      style={{ backgroundColor: peer.avatarColor || "#6366F1" }}
                    >
                      {peer.avatarEmoji || "💻"}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-xs truncate max-w-[110px]">
                        {peer.codename || peer.name}
                      </div>
                      <div className="text-[10px] opacity-80 flex items-center gap-1">
                        {getDeviceIcon(peer.formFactor, "w-3 h-3")}
                        <span>{peer.os || "Device"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="absolute bottom-4 inset-x-0 text-center pointer-events-none">
              <p className="text-[11px] text-[var(--text-muted)] font-medium max-w-xs mx-auto">
                No other devices found on this hotspot yet. Ensure the other phone or laptop is connected to this hotspot.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* COLLAPSIBLE OFFLINE BACKUP (PIN & OPTICAL PAIRING) */}
      <div className="border border-[var(--border-hairline)] rounded-2xl overflow-hidden bg-[var(--surface)]">
        <button
          type="button"
          onClick={() => setIsOfflineBackupOpen(!isOfflineBackupOpen)}
          className="w-full p-4 flex items-center justify-between text-left text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--text-muted)]" />
            <span>No mobile data? Use Offline Direct PIN / QR Pairing</span>
          </div>
          {isOfflineBackupOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isOfflineBackupOpen && (
          <div className="p-4 sm:p-5 pt-0 border-t border-[var(--border-hairline)] space-y-4 text-xs">
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              If your hotspot has no cellular data (air-gapped transfer), connect directly via this 6-digit room PIN or scan the session QR code.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Host PIN Display */}
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
                <span className="font-semibold text-xs text-[var(--text)] block">
                  Your Device PIN
                </span>
                <div className="flex items-center justify-between gap-2 p-2 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)]">
                  <span className="font-mono text-xl font-bold tracking-widest text-[var(--accent)] tabular-nums">
                    {formatRoomCode(localDevicePin)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyPin}
                      className="p-1.5 rounded-md hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                      title="Copy PIN"
                    >
                      {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsShowPinQrModalOpen(true)}
                      className="p-1.5 rounded-md hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                      title="Show Session QR"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Joiner Input */}
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
                <span className="font-semibold text-xs text-[var(--text)] block">
                  Connect to Another Device PIN
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter 6-digit PIN"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
                    className="flex-1 p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] font-mono text-center text-xs tracking-widest uppercase focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleManualConnect}
                    disabled={isConnectingManual || !manualCode.trim()}
                    className="px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    {isConnectingManual ? <RefreshCw className="w-3 h-3 animate-spin" /> : <span>Connect</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)] text-[var(--text)] transition-colors cursor-pointer"
                    title="Scan PIN QR"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Scanner Modal for Offline Pairing */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScannerSuccess}
      />

      {/* Session PIN QR Display Modal */}
      {isShowPinQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-xs p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-xl flex flex-col items-center space-y-4">
            <button
              onClick={() => setIsShowPinQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <span className="font-bold text-sm text-[var(--text)]">Hotspot Session PIN</span>

            <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200">
              <QRCodeSVG
                value={`${getOrigin()}/?room=${localDevicePin}`}
                size={180}
                level="M"
              />
            </div>

            <div className="font-mono text-2xl font-extrabold tracking-widest text-[var(--accent)] tabular-nums">
              {formatRoomCode(localDevicePin)}
            </div>

            <p className="text-[11px] text-center text-[var(--text-muted)]">
              Scan with the other device camera to connect immediately.
            </p>
          </div>
        </div>
      )}

      {/* Live WebRTC Transfer Modal */}
      <TransferModal
        progress={progress}
        onAccept={acceptIncomingTransfer}
        onReject={rejectIncomingTransfer}
        onClose={handleModalClose}
      />
    </div>
  );
}
