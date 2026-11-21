"use client";

import { useState, useEffect, useRef } from "react";
import {
  Radio,
  ExternalLink,
  QrCode,
  AlertCircle,
  ArrowRight,
  Camera,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { EstimateBadge } from "@/components/EstimateBadge";
import { TransferModal } from "@/components/TransferModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { OpticalHandshakeModal } from "@/components/OpticalHandshakeModal";
import { useOfflineHotspotRTC } from "@/hooks/useOfflineHotspotRTC";
import { ANDROID_INTENTS } from "@/lib/wifiQr";
import { encodeOpticalSdp } from "@/lib/opticalSdp";
import { getPayloadBytes } from "@/lib/transferEstimate";

export function HotspotAssistantCard() {
  const [role, setRole] = useState<"send" | "receive">("send");
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Optical Handshake / Offline QR state
  const [isHandshakeModalOpen, setIsHandshakeModalOpen] = useState(false);
  const [handshakeRole, setHandshakeRole] = useState<"sender" | "receiver">("sender");

  // Offline WebRTC DataChannel engine
  const offlineRtc = useOfflineHotspotRTC();
  const hasSentPayloadRef = useRef(false);

  const hasPayload = selectedPayload.files.length > 0 || selectedPayload.text.trim().length > 0;
  const payloadTotalBytes = getPayloadBytes(selectedPayload.files, selectedPayload.text);

  // Transmit payload once connection is established
  useEffect(() => {
    if (role === "send" && offlineRtc.isConnected && !hasSentPayloadRef.current) {
      hasSentPayloadRef.current = true;
      const hasFiles = selectedPayload.files.length > 0;
      const hasText = Boolean(selectedPayload.text.trim());
      if (hasFiles) {
        offlineRtc.sendFiles(selectedPayload.files).catch((err) => setErrorMsg(err.message));
      } else if (hasText) {
        offlineRtc.sendText(selectedPayload.text).catch((err) => setErrorMsg(err.message));
      }
    }
  }, [role, offlineRtc.isConnected, selectedPayload, offlineRtc]);

  const handleModalClose = () => {
    offlineRtc.cleanup();
    setIsHandshakeModalOpen(false);
    setErrorMsg(null);
    hasSentPayloadRef.current = false;
  };

  const handleStartSend = async () => {
    if (!hasPayload) return;
    setErrorMsg(null);
    setHandshakeRole("sender");
    hasSentPayloadRef.current = false;
    try {
      await offlineRtc.createOfflineOffer();
      setIsHandshakeModalOpen(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create hotspot handshake offer.");
    }
  };

  const handleStartReceive = () => {
    setErrorMsg(null);
    setHandshakeRole("receiver");
    setIsHandshakeModalOpen(true);
  };

  const displayError = errorMsg || offlineRtc.error;

  return (
    <div className="space-y-4">
      {/* Top Header with Role Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">Wi-Fi Hotspot</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Direct transfer over mobile hotspot — works with or without internet
          </p>
        </div>

        <SegmentedControl
          ariaLabel="Transfer Role"
          value={role}
          onChange={(val) => {
            setRole(val as "send" | "receive");
            handleModalClose();
          }}
          options={[
            { value: "send", label: "Send" },
            { value: "receive", label: "Receive" },
          ]}
        />
      </div>

      {displayError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Compact 1-line helper strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5 font-medium">
          <Radio className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
          <span>Turn on Mobile Hotspot on either device and connect the other via Wi-Fi</span>
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

      {/* TAB 1: SEND VIEW */}
      {role === "send" && (
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
            onClick={handleStartSend}
            disabled={!hasPayload}
            className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-sm shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Send</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 2: RECEIVE VIEW */}
      {role === "receive" && (
        <div className="space-y-4 p-8 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-center flex flex-col items-center justify-center animate-in fade-in">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <QrCode className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-xs">
            <h4 className="font-bold text-sm text-[var(--text)]">Ready to receive over Hotspot</h4>
            <p className="text-xs text-[var(--text-muted)]">
              Scan the sender&apos;s QR code to connect and receive files directly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartReceive}
            className="w-full max-w-xs py-3.5 px-6 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>Scan Sender&apos;s QR</span>
          </button>
        </div>
      )}

      {/* Optical Handshake Modal for Single-QR Pairing */}
      <OpticalHandshakeModal
        isOpen={isHandshakeModalOpen && !offlineRtc.isConnected}
        role={handshakeRole}
        localPayloadQr={offlineRtc.localQrPayload || undefined}
        onOfferScanned={async (decoded) => {
          try {
            setErrorMsg(null);
            const raw = encodeOpticalSdp(decoded.desc, decoded.candidates);
            await offlineRtc.acceptOfflineOffer(raw);
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Failed to parse offer QR");
          }
        }}
        onAnswerScanned={async (decoded) => {
          try {
            setErrorMsg(null);
            const raw = encodeOpticalSdp(decoded.desc, decoded.candidates);
            await offlineRtc.completeOfflineAnswer(raw);
            setIsHandshakeModalOpen(false);
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Failed to parse answer QR");
          }
        }}
        onClose={() => {
          setIsHandshakeModalOpen(false);
          offlineRtc.cleanup();
        }}
      />

      {/* Live WebRTC Transfer Modal */}
      <TransferModal
        progress={offlineRtc.progress}
        role={role === "send" ? "sender" : "receiver"}
        peerName="Hotspot Peer"
        diagnosticHint="Direct Wi-Fi Hotspot Connection (100% Offline)"
        onAccept={offlineRtc.acceptIncomingTransfer}
        onReject={offlineRtc.rejectIncomingTransfer}
        onClose={handleModalClose}
      />
    </div>
  );
}

export default HotspotAssistantCard;
