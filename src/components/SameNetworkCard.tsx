"use client";

import { useState } from "react";
import {
  Wifi,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowRight,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { TransferModal } from "@/components/TransferModal";
import { OpticalHandshakeModal } from "@/components/OpticalHandshakeModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { encodeOpticalSdp } from "@/lib/opticalSdp";
import type { TransferRole } from "@/types/mode";

export function SameNetworkCard() {
  const [role, setRole] = useState<TransferRole>("send");
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "",
  });
  const [isOpticalOpen, setIsOpticalOpen] = useState(false);
  const [opticalPayloadQr, setOpticalPayloadQr] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isOnline = useNetworkStatus();

  const {
    progress,
    sendFiles,
    sendPayload,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
  } = useWebRTC("same-network");

  const handleTransferSelected = () => {
    if (selectedPayload.files.length > 0) {
      sendFiles(selectedPayload.files).catch((err) => {
        setErrorMsg(err.message);
      });
    } else if (selectedPayload.text.trim()) {
      sendPayload({ text: selectedPayload.text }).catch((err) => {
        setErrorMsg(err.message);
      });
    }
  };

  const handleStartOpticalSender = async () => {
    if (selectedPayload.files.length === 0 && !selectedPayload.text.trim()) {
      setErrorMsg("Please select at least one file or enter text to share.");
      return;
    }

    try {
      setErrorMsg(null);
      const pc = new RTCPeerConnection({ iceServers: [] }); // Local LAN only
      pc.createDataChannel("lan-share", { ordered: true });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Collect host candidates
      const candidates: RTCIceCandidateInit[] = [];
      pc.onicecandidate = (e) => {
        if (e.candidate) candidates.push(e.candidate.toJSON());
      };

      // Wait a moment for local host candidate gathering
      await new Promise((res) => setTimeout(res, 300));

      const qrString = encodeOpticalSdp(offer, candidates);
      setOpticalPayloadQr(qrString);
      setIsOpticalOpen(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to initiate optical LAN handshake");
    }
  };

  const handleStartOpticalReceiver = () => {
    setErrorMsg(null);
    setIsOpticalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Role Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">
            Same Network (Local Wi-Fi LAN)
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Host ICE candidates prioritized for fast router-only routing
          </p>
        </div>

        <SegmentedControl
          ariaLabel="Transfer Role"
          value={role}
          onChange={(val) => setRole(val as TransferRole)}
          options={[
            { value: "send", label: "Send" },
            { value: "receive", label: "Receive" },
          ]}
        />
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Offline Alert when No Internet is Present */}
      {!isOnline && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text)]">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="leading-relaxed">
            <span className="font-semibold">Offline Network Detected: </span>
            External internet is unreachable on this Wi-Fi. The camera-to-camera optical handshake below enables 100% offline peer connection over your local router subnet.
          </div>
        </div>
      )}

      {/* Network Requirements Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text)]">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-neutral-600 dark:text-neutral-400" />
        <div className="leading-relaxed">
          <span className="font-semibold">Local Router Subnet: </span>
          Both devices must be connected to the same Wi-Fi router or Ethernet LAN. Transfers stream locally without consuming internet data.
        </div>
      </div>

      {role === "send" ? (
        <div className="space-y-4">
          <Dropzone onSelectionChange={setSelectedPayload} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleStartOpticalSender}
              className="py-3 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="h-4 w-4" />
              <span>Offline Camera QR Handshake</span>
            </button>
            <button
              type="button"
              onClick={handleTransferSelected}
              className="py-3 px-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-neutral-200/60 dark:hover:bg-neutral-750 font-semibold text-xs text-[var(--text)] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <Wifi className="h-4 w-4" />
              <span>Broadcast Over Subnet</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center space-y-4 max-w-md mx-auto">
          <div className="h-11 w-11 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs text-neutral-800 dark:text-neutral-200 flex items-center justify-center mx-auto">
            <Wifi className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--text)]">
              Ready to Ingest LAN Payload
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Ensure this device is connected to the same Wi-Fi as the sender.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartOpticalReceiver}
            className="w-full py-3 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Eye className="h-4 w-4" />
            <span>Scan Sender&apos;s Optical QR</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Optical Handshake Modal */}
      <OpticalHandshakeModal
        isOpen={isOpticalOpen}
        role={role === "send" ? "sender" : "receiver"}
        localPayloadQr={opticalPayloadQr}
        onOfferScanned={(decoded) => {
          console.log("Offer decoded:", decoded);
        }}
        onAnswerScanned={(decoded) => {
          console.log("Answer decoded:", decoded);
          handleTransferSelected();
        }}
        onClose={() => setIsOpticalOpen(false)}
      />

      {/* Transfer Progress Modal */}
      <TransferModal
        progress={progress}
        onAccept={acceptIncomingTransfer}
        onReject={rejectIncomingTransfer}
        onClose={cleanup}
      />
    </div>
  );
}
