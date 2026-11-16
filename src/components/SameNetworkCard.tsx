"use client";

import { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Edit2,
  Check,
  Send,
  AlertCircle,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { TransferModal } from "@/components/TransferModal";
import { QRScannerModal } from "@/components/QRScannerModal";
import { ConnectionDiagnostics } from "@/components/ConnectionDiagnostics";
import { RadarPanel } from "@/components/RadarPanel";
import { DirectConnectPanel } from "@/components/DirectConnectPanel";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useLocalDiscovery, type NearbyPeer } from "@/hooks/useLocalDiscovery";
import { formatRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";
import { getPayloadBytes } from "@/lib/transferEstimate";

function generateLanSessionCode(): string {
  return `lan${Math.floor(100000 + Math.random() * 900000)}`;
}

function generatePairPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function SameNetworkCard() {
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [targetPeer, setTargetPeer] = useState<NearbyPeer | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nearbyCode, setNearbyCode] = useState("");

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
  const [manualCode, setManualCode] = useState("");
  const [localDevicePin] = useState(generatePairPin);
  const [isShowQrModalOpen, setIsShowQrModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // When an incoming beam is directed to this device by a peer, automatically start receiver session
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

  const handleModalClose = () => {
    cleanup();
    setTargetPeer(null);
    setErrorMsg(null);
    processedBeamCodeRef.current = null;
    clearIncomingBeam().catch(() => {});
  };

  // When sender connects to target peer, automatically transmit selected payload
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

  const handleSendToPeer = async (peer: NearbyPeer) => {
    setTargetPeer(peer);
    setErrorMsg(null);

    // If no payload is selected yet, user is selecting the target device first
    const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
    if (!hasPayload) {
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

  const handleManualConnect = async (codeToUse?: string) => {
    const raw = codeToUse !== undefined ? codeToUse : manualCode;
    const clean = normalizeRoomCode(raw);
    if (!isValidRoomCode(clean)) {
      setErrorMsg("Please enter a valid 6-digit PIN.");
      return;
    }
    setErrorMsg(null);
    try {
      const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
      if (hasPayload) {
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

  return (
    <div className="space-y-6">
      {/* Network & Local Device Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">Same Wi-Fi</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Automatic local discovery. Tap any discovered device on the radar to send files directly over Wi-Fi.
          </p>
        </div>

        {/* Local Device Identity Badge */}
        <div className="flex items-center gap-2 bg-[var(--surface-subtle)] px-3 py-1.5 rounded-2xl border border-[var(--border-hairline)]">
          <div className="text-[var(--accent)]">{getDeviceIcon(profile.formFactor, "w-4 h-4")}</div>
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                className="text-xs bg-[var(--surface)] text-[var(--text)] px-2 py-0.5 rounded-lg border border-[var(--border-hairline)] focus:outline-none w-32"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-[var(--text)] truncate max-w-[140px]">
                {profile.name}
              </span>
              <button
                onClick={() => setIsEditingName(true)}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                title="Edit Device Name"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* File Dropzone */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-[var(--text)]">
            1. Select Files or Text to Share
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
          channel="same-network"
          totalBytes={getPayloadBytes(selectedPayload.files, selectedPayload.text)}
        />
        {targetPeer && (selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0) && (
          <button
            type="button"
            onClick={() => handleSendToPeer(targetPeer)}
            className="w-full py-3 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <span>Send to {targetPeer.avatarEmoji} {targetPeer.codename || targetPeer.name}</span>
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* RADAR DISCOVERY SCREEN */}
      <RadarPanel
        title={`2. Nearby Devices on this Wi-Fi (${peers.length})`}
        statusText={peers.length > 0 ? "Local Network Synced" : "Scanning local router..."}
        emptyText="Scanning local Wi-Fi... Open QuickSend on another device connected to this Wi-Fi to appear."
        myIdentity={profile}
        peers={peers}
        selectedPeerId={targetPeer?.id}
        onBeam={handleSendToPeer}
        onChangeAvatar={cycleAvatar}
      />

      {/* Direct PIN / QR Fallback & Nearby Code Accordion */}
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
              Enter the same 4-digit code on both devices to find each other across different subnets or carrier-grade NAT:
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
              onShowQr={() => {
                setIsShowQrModalOpen(true);
                startReceiver(localDevicePin).catch(() => {});
              }}
              peerPinValue={manualCode}
              onPeerPinChange={setManualCode}
              onConnect={handleManualConnect}
              onScanQr={() => setIsScannerOpen(true)}
            />
          </div>
        </div>
      </details>

      {/* Direct QR Modal */}
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

      {/* Immediate Camera QR Scanner Modal */}
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

export default SameNetworkCard;
