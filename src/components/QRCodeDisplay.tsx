"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { formatRoomCode } from "@/lib/codeGenerator";

interface QRCodeDisplayProps {
  code: string;
  url?: string;
}

export function QRCodeDisplay({ code, url }: QRCodeDisplayProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const displayUrl =
    url || (typeof window !== "undefined" ? `${window.location.origin}/?room=${code}` : `/?room=${code}`);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex flex-col items-center text-center space-y-4">
      {/* High contrast QR Container for reliable scanning */}
      <div className="p-5 bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-neutral-250">
        <QRCodeSVG
          value={displayUrl}
          size={180}
          level="M"
          includeMargin={false}
          className="rounded-xl"
        />
      </div>

      {/* Room Key Display */}
      <div className="space-y-1 max-w-sm">
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
          {code.length === 6
            ? "Session PIN Code"
            : /^\d{9,15}$/.test(code)
            ? "Mobile Pairing Number"
            : "Secret Room Keyword"}
        </span>
        <div className="inline-flex items-center justify-center gap-3 p-2 px-6 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 shadow-2xs">
          <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-[var(--accent)] tabular-nums break-all">
            {formatRoomCode(code)}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-2 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
            title="Copy Key"
          >
            {copiedCode ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Quick Actions (Pill button) */}
      <div className="flex items-center gap-2 text-xs pt-1">
        <button
          type="button"
          onClick={handleCopyUrl}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 font-semibold text-neutral-700 dark:text-neutral-200 transition-all shadow-2xs cursor-pointer"
        >
          {copiedUrl ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Direct Link Copied</span>
            </>
          ) : (
            <>
              <ExternalLink className="h-3.5 w-3.5 text-indigo-500" />
              <span>Copy Direct URL</span>
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
        Point phone camera at this QR code, or type the code on the receiving device.
      </p>
    </div>
  );
}
