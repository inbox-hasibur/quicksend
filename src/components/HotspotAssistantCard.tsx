"use client";

import { useState, useEffect, useRef } from "react";
import {
  Wifi,
  Radio,
  ExternalLink,
  QrCode,
  Sparkles,
  AlertCircle,
  X,
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Send,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { TransferModal } from "@/components/TransferModal";
import { QRScannerModal } from "@/components/QRScannerModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ConnectionDiagnostics } from "@/components/ConnectionDiagnostics";
import { RadarPanel } from "@/components/RadarPanel";
import { DirectConnectPanel } from "@/components/DirectConnectPanel";
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
  const [ssid, setSsid] = useState("QuickSend-Hotspot");
  const [password, setPassword] = useState("share1234");
  const [showWifiQr, setShowWifiQr] = useState(false);
  const [nearbyCode, setNearbyCode] = useState("");

  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [targetPeer, setTargetPeer] = useState<NearbyPeer | null>(null);

  // Fallback direct PIN / QR state
  const [localDevicePin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [manualCode, setManualCode] = useState("");
  const [isConnectingManual, setIsConnectingManual] = useState(false);
  const [isShowPinQrModalOpen, setIsShowPinQrModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    profile,
    peers,
    incomingBeam,
    beamToPeer,
    clearIncomingBeam,
    cycleAvatar,
    status: discoveryStatus,
  } = useLocalDiscovery(true, nearbyCode);

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
    diagnostics,
    debugLog,
  } = useWebRTC("same-network");

  const processedBeamCodeRef = useRef<string | null>(null);

  // Auto-join incoming beam when beamed by another device on the hotspot
  useEffect(() => {
    if (
      incomingBeam &&
      !isConnected &&
      (progress.status === "idle" || progress.status === "completed" || progress.status === "error" || progress.status === "rejected") &&
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
    processedBeamCodeRef.current = null;
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
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  const handleManualConnect = async (codeToUse?: string) => {
    const raw = codeToUse !== undefined ? codeToUse : manualCode;
    const code = normalizeRoomCode(raw);
    if (!isValidRoomCode(code)) {
      setErrorMsg("Please enter a valid 6-digit PIN.");
      return;
    }
    setErrorMsg(null);
    setIsConnectingManual(true);

    try {
      const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
      if (hasPayload) {
        await startSender(code);
      } else {
        await startReceiver(code);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect via direct PIN.");
    } finally {
      setIsConnectingManual(false);
    }
  };

  const handleScannerSuccess = (scannedCode: string) => {
    setIsScannerOpen(false);
    setManualCode(scannedCode);
    handleManualConnect(scannedCode);
  };

  const getDeviceIcon = (formFactor?: string, className = "w-4 h-4") => {
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

  const wifiQrString = buildWifiQrString({
    ssid,
    password,
    encryption: "WPA",
    hidden: false,
  });

  const getOrigin = () => {
    if (typeof window === "undefined") return "https://quicksend.vercel.app";
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "https://quicksend.vercel.app";
    }
    return window.location.origin;
  };

  return (
    <div className="space-y-6">
      {/* Network Header */}
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
      <RadarPanel
        title={`Devices on this Hotspot (${peers.length})`}
        statusText={peers.length > 0 ? "Hotspot Subnet Synced" : "Scanning hotspot..."}
        emptyText="No other devices found on this hotspot yet. Ensure the other phone or laptop is connected to this hotspot."
        myIdentity={profile}
        peers={peers}
        selectedPeerId={targetPeer?.id}
        onBeam={handleSendToPeer}
        onChangeAvatar={cycleAvatar}
      />

      {/* Fallback Connection: Nearby Code & Direct PIN/QR */}
      <details className="border border-[var(--border-hairline)] rounded-2xl bg-[var(--surface-subtle)] p-4 text-xs text-[var(--text-muted)] group">
        <summary className="font-semibold text-xs text-[var(--text)] cursor-pointer select-none">
          Can&apos;t see your device?
        </summary>
        <div className="pt-3 mt-3 border-t border-[var(--border-hairline)] space-y-4">
          {/* Option 1: Use a nearby code */}
          <div className="space-y-2">
            <div className="font-semibold text-xs text-[var(--text)]">
              Use a nearby code
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Enter the same 4-digit code on both devices:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="4-digit code"
                value={nearbyCode}
                onChange={(e) => setNearbyCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-32 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-sm font-mono font-bold text-center text-[var(--text)] focus:outline-none"
                aria-label="Nearby 4-digit pairing code"
              />
              <button
                type="button"
                onClick={() => setNearbyCode(Math.floor(1000 + Math.random() * 9000).toString())}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] hover:text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer"
              >
                Generate
              </button>
              {nearbyCode && (
                <button
                  type="button"
                  onClick={() => setNearbyCode("")}
                  className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer px-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Option 2: Connect with PIN or QR */}
          <div className="space-y-2 pt-3 border-t border-[var(--border-hairline)]">
            <div className="font-semibold text-xs text-[var(--text)]">
              Connect with PIN or QR
            </div>
            <DirectConnectPanel
              myPin={localDevicePin}
              myPinLabel="Your Device PIN"
              peerPinLabel="Connect to Another Device PIN"
              onShowQr={() => setIsShowPinQrModalOpen(true)}
              peerPinValue={manualCode}
              onPeerPinChange={setManualCode}
              onConnect={handleManualConnect}
              onScanQr={() => setIsScannerOpen(true)}
              isConnecting={isConnectingManual}
            />
          </div>
        </div>
      </details>

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

      {/* Live Connection Diagnostics */}
      <div className="pt-2">
        <ConnectionDiagnostics
          diagnostics={diagnostics}
          debugLog={debugLog}
          discoveryStatus={discoveryStatus}
        />
      </div>
    </div>
  );
}

export default HotspotAssistantCard;
