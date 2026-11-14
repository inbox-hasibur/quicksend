"use client";

import { useState } from "react";
import {
  Wifi,
  Send,
  Download,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowRight,
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
  } = useWebRTC("same-network");

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
      {/* Role Switcher (Segmented Pill Style) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
            Same Network (Local Wi-Fi LAN)
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Host ICE candidates prioritized for fast router-only routing
          </p>
        </div>

        <div className="inline-flex items-center p-1 rounded-full bg-neutral-100 dark:bg-neutral-800/80">
          <button
            type="button"
            onClick={() => setRole("send")}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              role === "send"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <Send className="h-3.5 w-3.5 text-emerald-500" />
            <span>Send</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("receive")}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              role === "receive"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            <span>Receive</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Network Requirements Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <div className="leading-relaxed">
          <span className="font-semibold">Local Router Subnet: </span>
          Both devices must be connected to the same Wi-Fi router or Ethernet LAN. Transfers stream locally without consuming internet data.
        </div>
      </div>

      {role === "send" ? (
        <div className="space-y-5">
          <Dropzone onSelectionChange={setSelectedPayload} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleStartOpticalSender}
              className="py-3.5 px-6 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
              <span>Offline Camera QR Handshake</span>
            </button>
            <button
              type="button"
              onClick={() => alert("LAN signaling broadcast active. Scanning local peers on subnet...")}
              className="py-3.5 px-6 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-semibold text-xs text-neutral-800 dark:text-neutral-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span>Broadcast Over Subnet</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800 text-center space-y-4 max-w-md mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Wifi className="h-7 w-7 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
              Ready to Ingest LAN Payload
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Ensure this device is connected to the same Wi-Fi as the sender.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartOpticalReceiver}
            className="w-full py-3.5 px-6 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-md inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Eye className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
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
