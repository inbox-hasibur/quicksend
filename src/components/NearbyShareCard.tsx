"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Share2,
  Smartphone,
  Send,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { TransferModal } from "@/components/TransferModal";
import { ConnectionDiagnostics } from "@/components/ConnectionDiagnostics";
import { NearbyPeerCard } from "@/components/NearbyPeerCard";
import { NearbyPairRequestModal } from "@/components/NearbyPairRequestModal";
import { useLocalDiscovery, type NearbyPeer } from "@/hooks/useLocalDiscovery";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useNearbyShare } from "@/hooks/useNearbyShare";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import { ANDROID_INTENTS } from "@/lib/wifiQr";
import { getPayloadBytes } from "@/lib/transferEstimate";

function generatePairRoomCode(): string {
  return `pair-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function NearbyShareCard() {
  const isOnline = useNetworkStatus();
  const [pairState, setPairState] = useState<"idle" | "requesting" | "connected">("idle");
  const [remotePeerName, setRemotePeerName] = useState<string>("");
  const [targetPin, setTargetPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Payload for connected sender transfer
  const [connectedPayload, setConnectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });

  // Payload for "More ways" system share
  const [moreWaysPayload, setMoreWaysPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });

  const {
    profile,
    peers,
    incomingBeam,
    beamToPeer,
    clearIncomingBeam,
    pin,
    lookupPin,
    status: discoveryStatus,
  } = useLocalDiscovery(true);

  const {
    role: rtcRole,
    isConnected,
    progress,
    startSender,
    startReceiver,
    sendFiles,
    sendText,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
    diagnostics,
    debugLog,
  } = useWebRTC("internet");

  const {
    capabilities,
    isSharing,
    shareSuccess,
    shareViaNative,
    errorMsg: nativeErrorMsg,
    clearError: clearNativeError,
  } = useNearbyShare();

  const requestTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Derive connected state when data channel opens
  const effectivePairState: "idle" | "requesting" | "connected" =
    pairState === "requesting" && isConnected ? "connected" : pairState;

  // Clear timeout once connected
  useEffect(() => {
    if (isConnected && requestTimerRef.current) {
      clearTimeout(requestTimerRef.current);
      requestTimerRef.current = null;
    }
  }, [isConnected]);

  // Handle incoming beam request when idle
  useEffect(() => {
    if (incomingBeam && effectivePairState !== "idle") {
      // Auto-decline incoming beams if busy
      clearIncomingBeam();
    }
  }, [incomingBeam, effectivePairState, clearIncomingBeam]);

  const handleCopyPin = async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleConnectToPeer = async (target: NearbyPeer) => {
    setRequestError(null);
    setPinError(null);
    setRemotePeerName(target.name || "Nearby Peer");
    setPairState("requesting");
    const roomCode = generatePairRoomCode();

    try {
      await startSender(roomCode);
      await beamToPeer(target.id, roomCode);
    } catch (err) {
      cleanup();
      setPairState("idle");
      setRequestError(err instanceof Error ? err.message : "Failed to send request.");
      return;
    }

    if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
    requestTimerRef.current = setTimeout(() => {
      cleanup();
      setPairState("idle");
      setRequestError("Request timed out. The other device didn't respond.");
    }, 45000);
  };

  const handleConnectPin = async () => {
    const clean = targetPin.trim();
    if (!/^\d{4}$/.test(clean)) return;
    setIsLookingUp(true);
    setPinError(null);
    setRequestError(null);

    try {
      const foundPeer = await lookupPin(clean);
      if (!foundPeer) {
        setPinError("No device with that PIN online.");
        setIsLookingUp(false);
        return;
      }
      setIsLookingUp(false);
      await handleConnectToPeer(foundPeer);
    } catch (err) {
      setIsLookingUp(false);
      setPinError(err instanceof Error ? err.message : "Failed to lookup PIN.");
    }
  };

  const handleAcceptIncoming = async () => {
    if (!incomingBeam) return;
    const fromName = incomingBeam.fromPeer.name || "Nearby Peer";
    const roomCode = incomingBeam.roomCode;
    setRemotePeerName(fromName);
    setPairState("connected");
    clearIncomingBeam();
    try {
      await startReceiver(roomCode);
    } catch (err) {
      cleanup();
      setPairState("idle");
      setRequestError(err instanceof Error ? err.message : "Failed to connect.");
    }
  };

  const handleDeclineIncoming = () => {
    clearIncomingBeam();
  };

  const handleDisconnect = () => {
    if (requestTimerRef.current) {
      clearTimeout(requestTimerRef.current);
      requestTimerRef.current = null;
    }
    cleanup();
    setPairState("idle");
    setRemotePeerName("");
    setRequestError(null);
  };

  const handleSendConnectedPayload = async () => {
    if (connectedPayload.files.length > 0) {
      await sendFiles(connectedPayload.files);
    } else if (connectedPayload.text.trim()) {
      await sendText(connectedPayload.text.trim());
    }
  };

  const handleTriggerNativeShare = async () => {
    clearNativeError();
    if (moreWaysPayload.files.length === 0 && !moreWaysPayload.text.trim()) {
      alert("Please select at least one file or enter text to share.");
      return;
    }

    const ok = await shareViaNative({
      files: moreWaysPayload.files.length > 0 ? moreWaysPayload.files : undefined,
      text: moreWaysPayload.text.trim() || undefined,
      title: "QuickSend Beam",
    });

    if (ok) {
      if (moreWaysPayload.files.length > 0) {
        for (const file of moreWaysPayload.files) {
          addTransferHistoryItem({
            direction: "sent",
            mode: "Nearby / Quick Share",
            itemType: "file",
            name: file.name,
            size: file.size,
            status: "completed",
          });
        }
      } else if (moreWaysPayload.text.trim()) {
        const text = moreWaysPayload.text.trim();
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
          <h3 className="font-bold text-base text-[var(--text)]">Nearby Pair</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Tap a nearby device or enter a PIN. Send after they accept.
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 bg-[var(--surface-subtle)] px-3 py-1.5 rounded-2xl border border-[var(--border-hairline)] text-xs">
          <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="font-medium text-[var(--text)]">Pair online, share offline</span>
        </div>
      </div>

      {/* Offline Notice */}
      {!isOnline ? (
        <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)]">
          Pairing needs internet. System share below works without internet.
        </div>
      ) : (
        <>
          {/* Request Error Banner */}
          {requestError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <span>{requestError}</span>
            </div>
          )}

          {/* 1. IDLE VIEW */}
          {effectivePairState === "idle" && (
            <div className="space-y-6">
              {/* This Device Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border border-[var(--border-hairline)] ${
                      profile.avatarColor || "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    <span>{profile.avatarEmoji || "🦊"}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text)]">{profile.name}</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Others can enter this PIN to connect, or tap your device below.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                      My PIN
                    </span>
                    <span className="font-mono text-xl sm:text-2xl font-black text-[var(--text)] tracking-wider">
                      {pin || "Allocating PIN..."}
                    </span>
                  </div>
                  {pin && (
                    <button
                      type="button"
                      onClick={handleCopyPin}
                      aria-label="Copy PIN"
                      className="p-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                      title="Copy PIN"
                    >
                      {copiedPin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Nearby Devices Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-[var(--text)] uppercase tracking-wider">
                  Nearby Devices
                </h4>
                {peers.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)]">
                    Looking for nearby devices... Make sure QuickSend is open on the other device.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {peers.map((peer) => (
                      <NearbyPeerCard
                        key={peer.id}
                        peer={peer}
                        onPress={() => handleConnectToPeer(peer)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Or Enter Their PIN Section */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
                <h4 className="font-bold text-xs text-[var(--text)]">Or enter their PIN</h4>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={targetPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setTargetPin(val);
                      setPinError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && targetPin.length === 4) {
                        handleConnectPin();
                      }
                    }}
                    placeholder="4-digit PIN"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text)] font-mono text-center sm:text-left text-sm tracking-widest focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={handleConnectPin}
                    disabled={targetPin.length !== 4 || isLookingUp}
                    className="py-2.5 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLookingUp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>Connect</span>
                    )}
                  </button>
                </div>
                {pinError && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">{pinError}</p>
                )}
              </div>
            </div>
          )}

          {/* 2. REQUESTING VIEW */}
          {effectivePairState === "requesting" && (
            <div className="p-8 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--accent)]" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[var(--text)]">
                  Waiting for {remotePeerName || "peer"} to accept...
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Please accept the connection prompt on the other device.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {/* 3. CONNECTED VIEW */}
          {effectivePairState === "connected" && (
            <div className="space-y-5 p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
              {/* Connected Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-sm text-[var(--text)]">
                    Connected to {remotePeerName || "Device"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text)] transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>

              {/* Sender View */}
              {rtcRole === "sender" ? (
                <div className="space-y-4">
                  <Dropzone onSelectionChange={setConnectedPayload} />
                  <EstimateBadge
                    channel="bluetooth"
                    totalBytes={getPayloadBytes(connectedPayload.files, connectedPayload.text)}
                  />
                  <button
                    type="button"
                    onClick={handleSendConnectedPayload}
                    disabled={connectedPayload.files.length === 0 && !connectedPayload.text.trim()}
                    className="w-full py-3.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </div>
              ) : (
                /* Receiver View */
                <div className="p-6 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-center space-y-2">
                  <p className="font-bold text-sm text-[var(--text)]">
                    Waiting for files from {remotePeerName || "peer"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    When incoming files arrive, accept them in the transfer prompt.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-[var(--text-muted)] italic text-center">
                The device that sends the request sends the files. To send the other way, send the
                request from the other device.
              </p>
            </div>
          )}

          {/* Incoming Pair Request Modal */}
          {incomingBeam && effectivePairState === "idle" && (
            <NearbyPairRequestModal
              peerName={incomingBeam.fromPeer.name || "Nearby Peer"}
              peerAvatar={incomingBeam.fromPeer.avatarEmoji || "🦊"}
              onAccept={handleAcceptIncoming}
              onDecline={handleDeclineIncoming}
            />
          )}
        </>
      )}

      {/* Native WebRTC Transfer Progress Modal */}
      <TransferModal
        progress={progress}
        onAccept={acceptIncomingTransfer}
        onReject={rejectIncomingTransfer}
        onClose={handleDisconnect}
      />

      {/* Connection Diagnostics */}
      <div className="pt-2">
        <ConnectionDiagnostics
          diagnostics={diagnostics}
          debugLog={debugLog}
          discoveryStatus={discoveryStatus}
        />
      </div>

      {/* 4. MORE WAYS: SYSTEM SHARE (COLLAPSED BY DEFAULT, OPEN OFFLINE) */}
      <details
        className="border border-[var(--border-hairline)] rounded-2xl overflow-hidden bg-[var(--surface)] text-xs"
        open={!isOnline ? true : undefined}
      >
        <summary className="p-4 font-semibold text-[var(--text)] cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors select-none">
          More ways: System share (Quick Share, AirDrop, Bluetooth)
        </summary>

        <div className="p-4 sm:p-5 pt-0 border-t border-[var(--border-hairline)] space-y-4">
          {nativeErrorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <span>{nativeErrorMsg}</span>
            </div>
          )}

          {shareSuccess && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Payload handed off to Native OS Share Sheet successfully!</span>
            </div>
          )}

          <div className="space-y-3">
            <span className="text-xs font-bold text-[var(--text)] block">
              Select Files or Text to Handoff
            </span>
            <Dropzone onSelectionChange={setMoreWaysPayload} />
            <EstimateBadge
              channel="bluetooth"
              totalBytes={getPayloadBytes(moreWaysPayload.files, moreWaysPayload.text)}
            />

            {!capabilities.hasWebShare ? (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Native Web Share is not supported in this browser. To send files to nearby devices
                  without restrictions, switch to <strong>Wi-Fi Hotspot</strong> or <strong>Same Wi-Fi</strong> mode.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleTriggerNativeShare}
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
            )}
          </div>

          {/* Receiving Guidance */}
          <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
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
          </div>

          {/* Bluetooth Settings Button */}
          <div>
            <a
              href={ANDROID_INTENTS.BLUETOOTH_SETTINGS}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text)] text-xs font-semibold shadow-2xs transition-colors"
            >
              <span>Open Bluetooth settings</span>
              <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
            </a>
          </div>
        </div>
      </details>
    </div>
  );
}
