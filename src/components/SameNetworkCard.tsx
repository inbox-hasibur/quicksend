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
  Radio,
  ChevronDown,
  ChevronUp,
  QrCode,
  AlertCircle,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { TransferModal } from "@/components/TransferModal";
import { OpticalHandshakeModal } from "@/components/OpticalHandshakeModal";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useLocalDiscovery, type NearbyPeer } from "@/hooks/useLocalDiscovery";
import { encodeOpticalSdp } from "@/lib/opticalSdp";

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
  const [isOpticalOpen, setIsOpticalOpen] = useState(false);
  const [opticalPayloadQr, setOpticalPayloadQr] = useState<string>("");
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

  const handleStartOpticalSender = async () => {
    if (selectedPayload.files.length === 0 && !selectedPayload.text.trim()) {
      setErrorMsg("Please select at least one file or enter text to share.");
      return;
    }

    try {
      setErrorMsg(null);
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("lan-share", { ordered: true });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const candidates: RTCIceCandidateInit[] = [];
      pc.onicecandidate = (e) => {
        if (e.candidate) candidates.push(e.candidate.toJSON());
      };

      await new Promise((res) => setTimeout(res, 300));
      const qrString = encodeOpticalSdp(offer, candidates);
      setOpticalPayloadQr(qrString);
      setIsOpticalOpen(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to initiate optical LAN handshake");
    }
  };

  return (
    <div className="space-y-6">
      {/* Network & Local Device Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-[var(--text)]">Same Wi-Fi (Local Radar)</h3>
            <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Radio className="w-3 h-3 animate-pulse" /> Live Radar
            </span>
          </div>
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

      {/* Direct PIN / Optical Fallback Accordion */}
      <div className="border border-[var(--border-hairline)] rounded-2xl overflow-hidden bg-[var(--surface-subtle)]">
        <button
          onClick={() => setIsManualExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 text-xs font-semibold text-[var(--text)] hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <span>Can&apos;t find device on radar? Use 6-Digit PIN or Camera Optical QR</span>
          {isManualExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isManualExpanded && (
          <div className="p-4 pt-2 border-t border-[var(--border-hairline)] space-y-4 bg-[var(--surface)]">
            <p className="text-xs text-[var(--text-muted)]">
              If your Wi-Fi router has Client Isolation enabled (common in public or guest Wi-Fi), devices cannot discover each other automatically. Use direct PIN or Optical Handshake below:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-[var(--text-muted)] block">
                  Connect by 6-Digit PIN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter PIN"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs text-[var(--text)] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (manualCode.trim()) {
                        startSender(manualCode.trim()).catch((err) => setErrorMsg(err.message));
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--text)] text-[var(--surface)] text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Connect
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-[var(--text-muted)] block">
                  Offline Camera Handshake
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleStartOpticalSender}
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text)] hover:bg-neutral-200/60 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" /> Show QR
                  </button>
                  <button
                    onClick={() => setIsOpticalOpen(true)}
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text)] hover:bg-neutral-200/60 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" /> Scan QR
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optical Handshake Modal for fallback */}
      <OpticalHandshakeModal
        isOpen={isOpticalOpen}
        onClose={() => setIsOpticalOpen(false)}
        role="sender"
        localPayloadQr={opticalPayloadQr}
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
