"use client";

import { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Edit2,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { TransferModal } from "@/components/TransferModal";
import { QRScannerModal } from "@/components/QRScannerModal";
import { RadarPanel } from "@/components/RadarPanel";
import { SegmentedControl } from "@/components/SegmentedControl";
import { LanDirectFallback } from "@/components/LanDirectFallback";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useLocalDiscovery, type NearbyPeer } from "@/hooks/useLocalDiscovery";
import { normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import { getPayloadBytes } from "@/lib/transferEstimate";

function generateLanSessionCode(): string {
  return `lan${Math.floor(100000 + Math.random() * 900000)}`;
}

function generatePairPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getDeviceIcon(formFactor: string, className = "w-4 h-4") {
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
}

export function SameNetworkCard() {
  const [role, setRole] = useState<"send" | "receive">("send");
  const [sendStep, setSendStep] = useState<1 | 2>(1);
  const [showDirectFallback, setShowDirectFallback] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [targetPeer, setTargetPeer] = useState<NearbyPeer | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nearbyCode, setNearbyCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [localDevicePin] = useState(generatePairPin);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRadarHint, setShowRadarHint] = useState(false);

  const {
    profile,
    peers,
    incomingBeam,
    beamToPeer,
    clearIncomingBeam,
    updateName,
    cycleAvatar,
    status: discoveryStatus,
  } = useLocalDiscovery(true, nearbyCode);

  const [customNameInput, setCustomNameInput] = useState(profile.name);

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
  const hasSentPayloadRef = useRef(false);

  // Radar 4-second hint timer when 0 peers appear
  useEffect(() => {
    if (peers.length > 0) return;
    const timer = setTimeout(() => {
      setShowRadarHint(true);
    }, 4000);
    return () => {
      clearTimeout(timer);
      setShowRadarHint(false);
    };
  }, [peers.length]);

  // When an incoming beam is directed to this device by a peer, automatically start receiver session
  useEffect(() => {
    if (
      incomingBeam &&
      !isConnected &&
      (progress.status === "idle" ||
        progress.status === "completed" ||
        progress.status === "error" ||
        progress.status === "rejected") &&
      processedBeamCodeRef.current !== incomingBeam.roomCode
    ) {
      processedBeamCodeRef.current = incomingBeam.roomCode;
      clearIncomingBeam().catch(() => {});
      startReceiver(incomingBeam.roomCode).catch(() => {});
    }
  }, [incomingBeam, isConnected, progress.status, clearIncomingBeam, startReceiver]);

  // When sender connects to target peer, automatically transmit selected payload ONCE
  useEffect(() => {
    if (rtcRole === "sender" && isConnected && !hasSentPayloadRef.current) {
      const hasFiles = selectedPayload.files.length > 0;
      const hasText = Boolean(selectedPayload.text.trim());
      if (!hasFiles && !hasText) return;

      hasSentPayloadRef.current = true;
      if (hasFiles) {
        sendFiles(selectedPayload.files).catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          hasSentPayloadRef.current = false;
        });
      } else {
        sendPayload({ text: selectedPayload.text }).catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          hasSentPayloadRef.current = false;
        });
      }
    }
  }, [rtcRole, isConnected, selectedPayload, sendFiles, sendPayload]);

  const handleModalClose = () => {
    cleanup();
    setTargetPeer(null);
    setErrorMsg(null);
    processedBeamCodeRef.current = null;
    hasSentPayloadRef.current = false;
    clearIncomingBeam().catch(() => {});
  };

  const handleSendToPeer = async (peer: NearbyPeer) => {
    setTargetPeer(peer);
    setErrorMsg(null);
    hasSentPayloadRef.current = false;

    const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
    if (!hasPayload) {
      setRole("send");
      setSendStep(1);
      return;
    }

    try {
      const sessionCode = generateLanSessionCode();
      await startSender(sessionCode);
      await beamToPeer(peer.id, sessionCode);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect to target device.");
    }
  };

  const handleSaveName = () => {
    if (customNameInput.trim()) {
      updateName(customNameInput.trim());
    }
    setIsEditingName(false);
  };

  const handleDirectConnect = async (codeToUse?: string) => {
    const raw = codeToUse !== undefined ? codeToUse : manualCode;
    const clean = normalizeRoomCode(raw);
    if (!isValidRoomCode(clean)) {
      setErrorMsg("Please enter a valid 6-digit PIN.");
      return;
    }
    setErrorMsg(null);
    try {
      const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
      if (hasPayload && role === "send") {
        await startSender(clean);
      } else {
        await startReceiver(clean);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect to PIN.");
    }
  };

  const handleScannerSuccess = async (scannedCode: string) => {
    setIsScannerOpen(false);
    setManualCode(scannedCode);
    await handleDirectConnect(scannedCode);
  };

  const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
  const payloadTotalBytes = getPayloadBytes(selectedPayload.files, selectedPayload.text);

  const fallbackElement = (
    <LanDirectFallback
      nearbyCode={nearbyCode}
      onNearbyCodeChange={setNearbyCode}
      localDevicePin={localDevicePin}
      manualCode={manualCode}
      onManualCodeChange={setManualCode}
      onConnect={handleDirectConnect}
      onStartReceiver={(pin) => startReceiver(pin).catch(() => {})}
      onScanQr={() => setIsScannerOpen(true)}
      onBackToRadar={() => setShowDirectFallback(false)}
      diagnostics={diagnostics}
      debugLog={debugLog}
      discoveryStatus={discoveryStatus}
    />
  );

  return (
    <div className="space-y-4">
      {/* Top Header with Role Switcher & Device Identity */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">Same Wi-Fi</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {role === "send"
              ? "Send files directly to nearby devices on this Wi-Fi"
              : "Receive files directly from nearby devices on this Wi-Fi"}
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
                  onClick={() => setIsEditingName(true)}
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
              setShowDirectFallback(false);
              cleanup();
              processedBeamCodeRef.current = null;
              hasSentPayloadRef.current = false;
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

      {/* TAB 1: SEND VIEW */}
      {role === "send" && (
        <div className="space-y-4">
          {/* STEP 1: Select Payload */}
          {sendStep === 1 && (
            <div className="space-y-3 animate-in fade-in">
              <Dropzone
                onSelectionChange={(payload) => {
                  setSelectedPayload(payload);
                  setErrorMsg(null);
                }}
              />
              <EstimateBadge channel="same-network" totalBytes={payloadTotalBytes} />
              <button
                type="button"
                onClick={() => setSendStep(2)}
                disabled={!hasPayload}
                className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-sm shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Find Devices</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Pick Receiver */}
          {sendStep === 2 && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSendStep(1);
                    setShowDirectFallback(false);
                    hasSentPayloadRef.current = false;
                  }}
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

              {!showDirectFallback ? (
                <>
                  <RadarPanel
                    title={`Discovered Devices (${peers.length})`}
                    statusText={peers.length > 0 ? "Local Network Synced" : "Scanning local router..."}
                    emptyText="Scanning local Wi-Fi... Open QuickSend on another device connected to this Wi-Fi to appear."
                    myIdentity={profile}
                    peers={peers}
                    selectedPeerId={targetPeer?.id}
                    onBeam={handleSendToPeer}
                    onChangeAvatar={cycleAvatar}
                  />

                  {showRadarHint && peers.length === 0 && (
                    <p className="text-center text-xs text-[var(--text-muted)] animate-in fade-in">
                      Not seeing your device? Routers sometimes split IPv4/IPv6 — use PIN or QR below.
                    </p>
                  )}

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDirectFallback(true)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Device not showing? Connect with PIN / QR
                    </button>
                  </div>
                </>
              ) : (
                fallbackElement
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECEIVE VIEW */}
      {role === "receive" && (
        <div className="space-y-3 animate-in fade-in">
          {!showDirectFallback ? (
            <>
              <RadarPanel
                title="Waiting for nearby sender on Wi-Fi..."
                statusText="Ready to receive"
                emptyText="Waiting for nearby sender on Wi-Fi... Tell the sender to tap your device avatar."
                myIdentity={profile}
                peers={peers}
                onChangeAvatar={cycleAvatar}
                onBeam={handleSendToPeer}
              />

              {showRadarHint && peers.length === 0 && (
                <p className="text-center text-xs text-[var(--text-muted)] animate-in fade-in">
                  Not seeing your device? Routers sometimes split IPv4/IPv6 — use PIN or QR below.
                </p>
              )}

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowDirectFallback(true)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                >
                  Connect with PIN or Scan QR
                </button>
              </div>
            </>
          ) : (
            fallbackElement
          )}
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScannerSuccess}
      />

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

export default SameNetworkCard;
