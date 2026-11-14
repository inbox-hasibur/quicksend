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
  ChevronDown,
  ChevronUp,
  QrCode,
  AlertCircle,
  Copy,
  Camera,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dropzone } from "@/components/Dropzone";
import { TransferModal } from "@/components/TransferModal";
import { QRScannerModal } from "@/components/QRScannerModal";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useLocalDiscovery, type NearbyPeer } from "@/hooks/useLocalDiscovery";
import { formatRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/codeGenerator";

function generateLanSessionCode(): string {
  return `lan${Math.floor(100000 + Math.random() * 900000)}`;
}

export function SameNetworkCard() {
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [targetPeer, setTargetPeer] = useState<NearbyPeer | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const {
    profile,
    peers,
    incomingBeam,
    beamToPeer,
    clearIncomingBeam,
    updateName,
    cycleAvatar,
  } = useLocalDiscovery(true);

  const [customNameInput, setCustomNameInput] = useState(profile.name);
  const [isManualExpanded, setIsManualExpanded] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [localDevicePin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [isShowQrModalOpen, setIsShowQrModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
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
  } = useWebRTC("same-network");

  const processedBeamCodeRef = useRef<string | null>(null);

  // When an incoming beam is directed to this device by a peer, automatically start receiver session
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

  const handleModalClose = () => {
    cleanup();
    setTargetPeer(null);
    setErrorMsg(null);
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

      {/* RADAR DISCOVERY SCREEN */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--text)]">
            2. Nearby Devices on this Wi-Fi ({peers.length})
          </label>
          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{peers.length > 0 ? "Local Network Synced" : "Scanning local router..."}</span>
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

          {/* Discovered Nearby Devices Placed Around Radar */}
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
                      // Radial stagger around radar
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
                      <div className="text-xs font-bold truncate max-w-[120px]">
                        {peer.codename || peer.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-medium">
                        {peer.os || "Device"} ({peer.browser || "Online"})
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Tap to Send
                      </div>
                    </div>
                    <Send className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity ml-1" />
                  </button>
                );
              })}
            </div>
          ) : (
            /* Empty State hint inside radar */
            <div className="absolute bottom-4 inset-x-4 text-center pointer-events-none">
              <p className="text-[11px] text-[var(--text-muted)] bg-[var(--surface)]/90 backdrop-blur-xs py-1.5 px-3 rounded-full border border-[var(--border-hairline)] inline-block shadow-xs">
                Scanning local Wi-Fi... Open QuickSend on another device connected to this Wi-Fi to appear.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Direct PIN / QR Fallback Accordion */}
      <div className="border border-[var(--border-hairline)] rounded-2xl overflow-hidden bg-[var(--surface-subtle)]">
        <button
          type="button"
          onClick={() => setIsManualExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 text-xs font-semibold text-[var(--text)] hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
        >
          <span>Can&apos;t find device on radar? Use 6-Digit PIN or QR Code</span>
          {isManualExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isManualExpanded && (
          <div className="p-4 pt-2 border-t border-[var(--border-hairline)] space-y-4 bg-[var(--surface)]">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              If client isolation is active on your router, devices cannot find each other on the radar. Use this device&apos;s PIN or scan QR directly:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* This Device's PIN & QR Display */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                    This Device PIN
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-[var(--surface)] p-2 rounded-xl border border-[var(--border-hairline)]">
                  <span className="font-mono text-base font-bold text-[var(--text)] tracking-wider">
                    {formatRoomCode(localDevicePin)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopyPin}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                      title="Copy PIN"
                    >
                      {copiedPin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsShowQrModalOpen(true);
                        startReceiver(localDevicePin).catch(() => {});
                      }}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Show QR
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Share this PIN or QR with the sender to connect directly.
                </p>
              </div>

              {/* Connect to Peer's PIN or Instant Scan */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] block">
                  Connect by Peer&apos;s PIN or QR
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter 6-Digit PIN"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-xs text-[var(--text)] font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleManualConnect}
                    className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                  >
                    Connect
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full py-2 px-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-xs font-semibold text-[var(--text)] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Scan QR Code with Camera</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Direct QR Modal */}
      {isShowQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
              <span className="font-bold text-sm text-[var(--text)]">Direct Wi-Fi Room QR</span>
              <button
                type="button"
                onClick={() => setIsShowQrModalOpen(false)}
                className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-neutral-200 inline-block mx-auto shadow-sm">
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
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold transition-all cursor-pointer shadow-xs"
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
    </div>
  );
}
