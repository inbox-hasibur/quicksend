"use client";

import { useState, useEffect, useRef } from "react";
import {
  Radio,
  ExternalLink,
  QrCode,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Edit2,
  Camera,
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { TransferModal } from "@/components/TransferModal";
import { RadarPanel } from "@/components/RadarPanel";
import { SegmentedControl } from "@/components/SegmentedControl";
import { OpticalHandshakeModal } from "@/components/OpticalHandshakeModal";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useLocalDiscovery, type NearbyPeer } from "@/hooks/useLocalDiscovery";
import { useOfflineHotspotRTC } from "@/hooks/useOfflineHotspotRTC";
import { useBrowserCapabilities } from "@/hooks/useNetworkStatus";
import { ANDROID_INTENTS } from "@/lib/wifiQr";
import { encodeOpticalSdp } from "@/lib/opticalSdp";
import { getPayloadBytes } from "@/lib/transferEstimate";

function generateHotspotSessionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function HotspotAssistantCard() {
  const [role, setRole] = useState<"send" | "receive">("send");
  const [sendStep, setSendStep] = useState<1 | 2>(1);
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [targetPeer, setTargetPeer] = useState<NearbyPeer | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Optical Handshake / Offline QR state
  const [isOfflineActive, setIsOfflineActive] = useState(false);
  const [isHandshakeModalOpen, setIsHandshakeModalOpen] = useState(false);
  const [handshakeRole, setHandshakeRole] = useState<"sender" | "receiver">("sender");

  // Device name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState("");

  const { isOnline } = useBrowserCapabilities();

  // 1. Online discovery & WebRTC (Mode 2 engine)
  const {
    profile,
    peers,
    incomingBeam,
    beamToPeer,
    clearIncomingBeam,
    cycleAvatar,
    updateName,
  } = useLocalDiscovery(isOnline);

  const {
    role: rtcRole,
    isConnected,
    progress: onlineProgress,
    startSender,
    startReceiver,
    sendFiles,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup: onlineCleanup,
    diagnostics,
  } = useWebRTC("same-network");

  // 2. Offline WebRTC via optical QR SDP
  const offlineRtc = useOfflineHotspotRTC();

  const processedBeamCodeRef = useRef<string | null>(null);
  const hasSentOnlinePayloadRef = useRef(false);
  const hasSentOfflinePayloadRef = useRef(false);

  const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
  const payloadTotalBytes = getPayloadBytes(selectedPayload.files, selectedPayload.text);

  // Auto-join incoming beam when beamed online
  useEffect(() => {
    if (
      !isOfflineActive &&
      incomingBeam &&
      !isConnected &&
      (onlineProgress.status === "idle" ||
        onlineProgress.status === "completed" ||
        onlineProgress.status === "error" ||
        onlineProgress.status === "rejected") &&
      processedBeamCodeRef.current !== incomingBeam.roomCode
    ) {
      processedBeamCodeRef.current = incomingBeam.roomCode;
      clearIncomingBeam().catch(() => {});
      startReceiver(incomingBeam.roomCode).catch(() => {});
    }
  }, [isOfflineActive, incomingBeam, isConnected, onlineProgress.status, clearIncomingBeam, startReceiver]);

  // Transmit online payload once connection is established
  useEffect(() => {
    if (!isOfflineActive && rtcRole === "sender" && isConnected && !hasSentOnlinePayloadRef.current) {
      hasSentOnlinePayloadRef.current = true;
      const hasFiles = selectedPayload.files.length > 0;
      const hasText = Boolean(selectedPayload.text.trim());
      if (hasFiles) {
        sendFiles(selectedPayload.files).catch((err) => setErrorMsg(err.message));
      } else if (hasText) {
        sendPayload({ text: selectedPayload.text }).catch((err) => setErrorMsg(err.message));
      }
    }
  }, [isOfflineActive, rtcRole, isConnected, selectedPayload, sendFiles, sendPayload]);

  // Transmit offline payload once offline data channel is established
  useEffect(() => {
    if (isOfflineActive && offlineRtc.isConnected && !hasSentOfflinePayloadRef.current) {
      hasSentOfflinePayloadRef.current = true;
      const hasFiles = selectedPayload.files.length > 0;
      const hasText = Boolean(selectedPayload.text.trim());
      if (hasFiles) {
        offlineRtc.sendFiles(selectedPayload.files).catch((err) => setErrorMsg(err.message));
      } else if (hasText) {
        offlineRtc.sendText(selectedPayload.text).catch((err) => setErrorMsg(err.message));
      }
    }
  }, [isOfflineActive, offlineRtc.isConnected, selectedPayload, offlineRtc]);

  const handleModalClose = () => {
    onlineCleanup();
    offlineRtc.cleanup();
    setIsOfflineActive(false);
    setIsHandshakeModalOpen(false);
    setTargetPeer(null);
    setErrorMsg(null);
    hasSentOnlinePayloadRef.current = false;
    hasSentOfflinePayloadRef.current = false;
    processedBeamCodeRef.current = null;
    clearIncomingBeam().catch(() => {});
  };

  const handleSendToPeer = async (peer: NearbyPeer) => {
    setTargetPeer(peer);
    setErrorMsg(null);
    hasSentOnlinePayloadRef.current = false;
    setIsOfflineActive(false);

    if (!hasPayload) return;

    try {
      const sessionCode = generateHotspotSessionCode();
      await startSender(sessionCode);
      await beamToPeer(peer.id, sessionCode);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect to target device.");
    }
  };

  const handleOnlineSendClick = async () => {
    if (!hasPayload) return;
    setErrorMsg(null);
    if (peers.length === 1) {
      await handleSendToPeer(peers[0]);
    } else {
      setSendStep(2);
    }
  };

  const handleStartOfflineSend = async () => {
    if (!hasPayload) return;
    setErrorMsg(null);
    setIsOfflineActive(true);
    setHandshakeRole("sender");
    hasSentOfflinePayloadRef.current = false;
    try {
      await offlineRtc.createOfflineOffer();
      setIsHandshakeModalOpen(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create offline handshake offer.");
    }
  };

  const handleStartOfflineReceive = () => {
    setErrorMsg(null);
    setIsOfflineActive(true);
    setHandshakeRole("receiver");
    setIsHandshakeModalOpen(true);
  };

  const handleSaveName = () => {
    if (customNameInput.trim()) {
      updateName(customNameInput.trim());
    }
    setIsEditingName(false);
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

  return (
    <div className="space-y-4">
      {/* Top Header with Role Switcher & Device Identity */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">Wi-Fi Hotspot</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {role === "send"
              ? "Send files directly to devices on this mobile hotspot"
              : "Receive files directly from devices on this mobile hotspot"}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Local Device Identity Badge */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-subtle)] px-2.5 py-1 rounded-2xl border border-[var(--border-hairline)]">
            <div className="text-[var(--accent)]">{getDeviceIcon(profile.formFactor)}</div>
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="text-xs bg-[var(--surface)] text-[var(--text)] px-2 py-0.5 rounded-lg border border-[var(--border-hairline)] focus:outline-none w-28"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                  title="Save Name"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-[var(--text)] truncate max-w-[120px]">
                  {profile.name}
                </span>
                <button
                  onClick={() => {
                    setCustomNameInput(profile.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                  title="Edit Device Name"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <SegmentedControl
            ariaLabel="Transfer Role"
            value={role}
            onChange={(val) => {
              setRole(val as "send" | "receive");
              setErrorMsg(null);
              setSendStep(1);
              handleModalClose();
            }}
            options={[
              { value: "send", label: "Send" },
              { value: "receive", label: "Receive" },
            ]}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Compact 1-line helper bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5 font-medium">
          <Radio className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
          <span>Connect both devices to the same Mobile Hotspot</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold shrink-0">
          <a
            href={ANDROID_INTENTS.TETHER_SETTINGS}
            className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors"
          >
            <span>Hotspot Settings</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <span>•</span>
          <a
            href={ANDROID_INTENTS.WIFI_SETTINGS}
            className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors"
          >
            <span>Wi-Fi Settings</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Offline Mode Indicator Pill */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold text-center">
          <QrCode className="h-3.5 w-3.5" />
          <span>Offline Hotspot Mode • Direct QR Pair (No Internet Needed)</span>
        </div>
      )}

      {/* TAB 1: SEND VIEW */}
      {role === "send" && (
        <div className="space-y-4">
          {/* WHEN OFFLINE: Dropzone + Direct Offline QR Pair Button */}
          {!isOnline ? (
            <div className="space-y-3 animate-in fade-in">
              <Dropzone
                onSelectionChange={(payload) => {
                  setSelectedPayload(payload);
                  setErrorMsg(null);
                }}
              />
              <EstimateBadge channel="hotspot" totalBytes={payloadTotalBytes} />
              <button
                type="button"
                onClick={handleStartOfflineSend}
                disabled={!hasPayload}
                className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-sm shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Send via Offline QR</span>
              </button>
            </div>
          ) : (
            /* WHEN ONLINE: Smart Step-by-Step Flow */
            <>
              {sendStep === 1 && (
                <div className="space-y-3 animate-in fade-in">
                  <Dropzone
                    onSelectionChange={(payload) => {
                      setSelectedPayload(payload);
                      setErrorMsg(null);
                    }}
                  />
                  <EstimateBadge channel="hotspot" totalBytes={payloadTotalBytes} />
                  <button
                    type="button"
                    onClick={handleOnlineSendClick}
                    disabled={!hasPayload}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-sm shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Send</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {sendStep === 2 && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSendStep(1)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] hover:bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text)] transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>
                        Change files (
                        {selectedPayload.files.length > 0
                          ? `${selectedPayload.files.length} file${selectedPayload.files.length > 1 ? "s" : ""}`
                          : "text"}
                        )
                      </span>
                    </button>
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      Tap a device to send
                    </span>
                  </div>

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

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleStartOfflineSend}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <QrCode className="h-3 w-3" />
                      <span>No internet on other device? Pair via Offline QR</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: RECEIVE VIEW */}
      {role === "receive" && (
        <div className="space-y-3 animate-in fade-in">
          {!isOnline ? (
            /* WHEN OFFLINE: Prominent Scan Sender's QR Button */
            <div className="space-y-4 p-8 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-center flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-xs">
                <h4 className="font-bold text-sm text-[var(--text)]">Receive without Internet</h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Scan the sender&apos;s optical QR code to establish a zero-internet direct connection.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartOfflineReceive}
                className="w-full max-w-xs py-3.5 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Sender&apos;s QR to Receive</span>
              </button>
            </div>
          ) : (
            /* WHEN ONLINE: Waiting Radar + Offline QR fallback link */
            <>
              <RadarPanel
                title="Waiting on Hotspot..."
                statusText="Ready to receive on Hotspot"
                emptyText="Waiting for a sender to beam files... Tell the sender to tap your device avatar."
                myIdentity={profile}
                peers={peers}
                onChangeAvatar={cycleAvatar}
                onBeam={handleSendToPeer}
              />

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleStartOfflineReceive}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer inline-flex items-center gap-1"
                >
                  <QrCode className="h-3 w-3" />
                  <span>Pair via Offline QR</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Optical Handshake Modal for Zero-Internet QR Pairing */}
      <OpticalHandshakeModal
        isOpen={isHandshakeModalOpen && !offlineRtc.isConnected}
        role={handshakeRole}
        localPayloadQr={offlineRtc.localQrPayload || undefined}
        onOfferScanned={async (decoded) => {
          try {
            const raw = encodeOpticalSdp(decoded.desc, decoded.candidates);
            await offlineRtc.acceptOfflineOffer(raw);
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Failed to parse offer QR");
          }
        }}
        onAnswerScanned={async (decoded) => {
          try {
            const raw = encodeOpticalSdp(decoded.desc, decoded.candidates);
            await offlineRtc.completeOfflineAnswer(raw);
            setIsHandshakeModalOpen(false);
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Failed to parse answer QR");
          }
        }}
        onClose={() => setIsHandshakeModalOpen(false)}
      />

      {/* Live WebRTC Transfer Modal (Online or Offline) */}
      <TransferModal
        progress={isOfflineActive ? offlineRtc.progress : onlineProgress}
        role={isOfflineActive ? (handshakeRole === "sender" ? "sender" : "receiver") : rtcRole}
        peerName={targetPeer?.codename || targetPeer?.name}
        diagnosticHint={
          isOfflineActive
            ? "Offline Hotspot Direct QR Connection"
            : `ICE: ${diagnostics.iceState} • host: ${diagnostics.candidateCounts.host}, srflx: ${diagnostics.candidateCounts.srflx}, relay: ${diagnostics.candidateCounts.relay}`
        }
        onAccept={isOfflineActive ? offlineRtc.acceptIncomingTransfer : acceptIncomingTransfer}
        onReject={isOfflineActive ? offlineRtc.rejectIncomingTransfer : rejectIncomingTransfer}
        onClose={handleModalClose}
      />
    </div>
  );
}

export default HotspotAssistantCard;
