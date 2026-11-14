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
  Send,
  Download,
  ArrowRight,
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
  const [ssid, setSsid] = useState("QuickSend-Hotspot");
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
      setErrorMsg(err instanceof Error ? err.message : "Failed to initiate hotspot optical handshake");
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Switcher (Segmented Pill Style) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
            Wi-Fi + Hotspot Assistant
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Zero-internet transfer via mobile AP &amp; optical QR pairing
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
            <Send className="h-3.5 w-3.5 text-amber-500" />
            <span>Send (Host AP)</span>
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
            <Download className="h-3.5 w-3.5 text-amber-500" />
            <span>Receive (Join AP)</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SENDER: Step-by-Step Hotspot Setup */}
      {role === "send" ? (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Radio className="h-4 w-4 text-amber-500" />
                <span>Step 1: Configure Hotspot Credentials</span>
              </div>
              <a
                href={ANDROID_INTENTS.TETHER_SETTINGS}
                className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-medium"
              >
                <span>Android Hotspot Settings</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                  Hotspot Name (SSID)
                </label>
                <input
                  type="text"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                  Password
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowWifiQr(!showWifiQr)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                <QrCode className="h-4 w-4" />
                <span>{showWifiQr ? "Hide Wi-Fi Join QR" : "Show Wi-Fi Join QR Code"}</span>
              </button>
            </div>

            {showWifiQr && (
              <div className="flex flex-col items-center p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2 animate-in fade-in">
                <div className="p-3 bg-white rounded-2xl shadow-sm">
                  <QRCodeSVG value={wifiQrString} size={160} level="M" />
                </div>
                <p className="text-[11px] text-neutral-500 text-center max-w-xs">
                  Scan this QR code with the receiver phone&apos;s camera to automatically join this hotspot without typing the password!
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block px-1">
              Step 2: Select Files or Text to Beam
            </span>
            <Dropzone onSelectionChange={setSelectedPayload} />
          </div>

          <button
            type="button"
            onClick={handleStartOpticalSender}
            className="w-full py-4 px-6 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Eye className="h-4 w-4 text-amber-400 dark:text-amber-600" />
            <span>Generate Optical WebRTC QR Handshake</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        /* RECEIVER FLOW */
        <div className="p-8 rounded-3xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800 text-center space-y-5 max-w-md mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Smartphone className="h-7 w-7" />
          </div>
          <div>
            <h4 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
              Join Sender&apos;s Hotspot
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
              Scan the sender&apos;s Wi-Fi QR code with your camera or connect to their hotspot in Wi-Fi settings.
            </p>
          </div>

          <div className="space-y-2">
            <a
              href={ANDROID_INTENTS.WIFI_SETTINGS}
              className="w-full py-3 px-4 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <Wifi className="h-3.5 w-3.5 text-amber-500" />
              <span>Open Android Wi-Fi Settings</span>
              <ExternalLink className="h-3 w-3 text-neutral-400" />
            </a>

            <button
              type="button"
              onClick={() => setIsOpticalOpen(true)}
              className="w-full py-3.5 px-6 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="h-4 w-4 text-amber-400 dark:text-amber-600" />
              <span>Scan Sender&apos;s Optical QR</span>
              <ArrowRight className="h-4 w-4" />
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
