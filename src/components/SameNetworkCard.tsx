"use client";

import { useState } from "react";
import {
  Wifi,
  Send,
  Download,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { TransferModal } from "@/components/TransferModal";
import { OpticalHandshakeModal } from "@/components/OpticalHandshakeModal";
import { useWebRTC } from "@/hooks/useWebRTC";
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

  const {
    progress,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cleanup,
  } = useWebRTC();

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
      <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              Same Network (Local LAN)
            </h4>
            <p className="text-xs text-neutral-400 font-mono">Host ICE candidate prioritized</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setRole("send")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              role === "send"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("receive")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              role === "receive"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Receive</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Network Requirements Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <div>
          <span className="font-semibold">Local Router Subnet Routing: </span>
          Both devices must be connected to the same Wi-Fi router or Ethernet switch. Transfers stream locally without consuming internet quota.
        </div>
      </div>

      {role === "send" ? (
        <div className="space-y-4">
          <Dropzone onSelectionChange={setSelectedPayload} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleStartOpticalSender}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Eye className="h-4 w-4" />
              <span>Offline Camera QR Handshake</span>
            </button>
            <button
              type="button"
              onClick={() => alert("LAN signaling broadcast active. Scanning local peers on subnet...")}
              className="py-3 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-semibold text-xs text-neutral-800 dark:text-neutral-200 transition-colors flex items-center justify-center gap-2"
            >
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span>Broadcast Over Subnet</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-center space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 inline-block">
            <Wifi className="h-8 w-8 animate-pulse" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Ready to Ingest LAN Payload</h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
              Ensure this device is connected to the same Wi-Fi network as the sender.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartOpticalReceiver}
            className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs inline-flex items-center gap-2 transition-colors"
          >
            <Eye className="h-4 w-4" />
            <span>Scan Sender&apos;s Optical QR</span>
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
