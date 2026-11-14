"use client";

import { useState } from "react";
import {
  Smartphone,
  Wifi,
  ExternalLink,
  QrCode,
  Eye,
  AlertCircle,
  Radio,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dropzone } from "@/components/Dropzone";
import { TransferModal } from "@/components/TransferModal";
import { OpticalHandshakeModal } from "@/components/OpticalHandshakeModal";
import { useWebRTC } from "@/hooks/useWebRTC";
import { buildWifiQrString, ANDROID_INTENTS } from "@/lib/wifiQr";
import { encodeOpticalSdp } from "@/lib/opticalSdp";
import type { TransferRole } from "@/types/mode";

export function HotspotAssistantCard() {
  const [role, setRole] = useState<TransferRole>("send");
  const [ssid, setSsid] = useState("ShareAnything-Hotspot");
  const [password, setPassword] = useState("12345678");
  const [showWifiQr, setShowWifiQr] = useState(false);
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

  const wifiQrString = buildWifiQrString({
    ssid,
    password,
    encryption: password ? "WPA" : "nopass",
  });

  const handleStartOpticalSender = async () => {
    if (selectedPayload.files.length === 0 && !selectedPayload.text.trim()) {
      setErrorMsg("Please select at least one file or enter text to share.");
      return;
    }

    try {
      setErrorMsg(null);
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("hotspot-share", { ordered: true });

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
      setErrorMsg(err instanceof Error ? err.message : "Failed to start optical handshake");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Role Switcher */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              Wi-Fi + Hotspot Interface
            </h4>
            <p className="text-xs text-neutral-400 font-mono">Zero-Internet PWA &amp; QR Handshake</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setRole("send")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              role === "send"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <span>Host &amp; Send</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("receive")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              role === "receive"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <span>Join &amp; Receive</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Honest Browser Sandbox Note */}
      <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5" />
          <span>Offline Transfer Orchestrator</span>
        </p>
        <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
          Web browsers cannot turn on physical phone hotspot hardware directly. This interface guides you to activate your mobile AP, generates a standardized Wi-Fi QR code for camera auto-joining, and establishes an optical WebRTC handshake.
        </p>
      </div>

      {role === "send" ? (
        <div className="space-y-5">
          {/* Step 1: Hotspot Configuration */}
          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Step 1: Your Hotspot Credentials
              </span>
              <a
                href={ANDROID_INTENTS.TETHER_SETTINGS}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
              >
                <span>Open Hotspot Settings</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Hotspot Network Name (SSID)</label>
                <input
                  type="text"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Hotspot Password (Optional)</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty if open"
                  className="w-full p-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowWifiQr(!showWifiQr)}
              className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 hover:underline"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>{showWifiQr ? "Hide Wi-Fi Join QR Code" : "Show Wi-Fi Join QR Code"}</span>
            </button>

            {showWifiQr && (
              <div className="pt-3 flex flex-col items-center text-center space-y-2 animate-in fade-in">
                <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm">
                  <QRCodeSVG value={wifiQrString} size={180} level="M" />
                </div>
                <p className="text-[11px] text-neutral-400 max-w-xs">
                  The receiver scans this QR code with their native camera to instantly join your Wi-Fi network without typing passwords.
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Select Payload & Optical Handshake */}
          <div className="space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block px-1">
              Step 2: Select Files &amp; Initiate Optical Handshake
            </span>
            <Dropzone onSelectionChange={setSelectedPayload} />

            <button
              type="button"
              onClick={handleStartOpticalSender}
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Eye className="h-4 w-4" />
              <span>Launch Camera-to-Camera Optical Handshake</span>
            </button>
          </div>
        </div>
      ) : (
        /* Receiver View */
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-4 text-center">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 inline-block">
            <Wifi className="h-8 w-8 animate-pulse" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Join Sender&apos;s Hotspot</h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
              Scan the sender&apos;s Wi-Fi QR code with your native phone camera, or connect via Wi-Fi settings.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <a
              href={ANDROID_INTENTS.WIFI_SETTINGS}
              className="py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <span>Open Wi-Fi Settings</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={() => setIsOpticalOpen(true)}
              className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Scan Sender Optical QR</span>
            </button>
          </div>
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
