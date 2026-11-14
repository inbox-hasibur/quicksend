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
      <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200">
        <QRCodeSVG
          value={displayUrl}
          size={190}
          level="M"
          includeMargin={false}
          className="rounded-lg"
        />
      </div>

      {/* 6-Digit Code Display */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Room PIN Code
        </span>
        <div className="flex items-center justify-center gap-2">
          <span className="font-mono text-3xl font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400">
            {formatRoomCode(code)}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Copy PIN"
          >
            {copiedCode ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleCopyUrl}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium transition-colors"
        >
          {copiedUrl ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Link Copied</span>
            </>
          ) : (
            <>
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Copy Direct Link</span>
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
        Scan this QR code with any smartphone camera, or enter the 6-digit PIN on the receiving device.
      </p>
    </div>
  );
}
