"use client";

import { useState, useRef, useCallback } from "react";
import type { WebRTCDiagnostics, DebugLogEntry } from "@/hooks/useWebRTC";
import type { DiscoveryStatus } from "@/hooks/useLocalDiscovery";

export interface ConnectionDiagnosticsProps {
  diagnostics: WebRTCDiagnostics;
  debugLog: DebugLogEntry[];
  discoveryStatus?: DiscoveryStatus;
}

export function ConnectionDiagnostics({
  diagnostics,
  debugLog,
  discoveryStatus,
}: ConnectionDiagnosticsProps) {
  const [storageMode, setStorageMode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hasFetchedHealthRef = useRef(false);

  const fetchHealth = useCallback(async () => {
    if (hasFetchedHealthRef.current) return;
    hasFetchedHealthRef.current = true;
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setStorageMode(data.storage || "unknown");
      } else {
        setStorageMode("error");
      }
    } catch {
      setStorageMode("unreachable");
    }
  }, []);

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if ((e.currentTarget as HTMLDetailsElement).open) {
      fetchHealth();
    }
  };

  const generateReport = (): string => {
    const lines: string[] = [
      "=== WebRTC Connection Report ===",
      `Timestamp: ${new Date().toISOString()}`,
      `Server storage: ${storageMode ?? "loading..."}${
        storageMode === "memory"
          ? " (Warning: memory storage is not shared between server instances)"
          : ""
      }`,
      `Network group: ${discoveryStatus?.groupLabel ?? "n/a"} (${
        discoveryStatus?.ipFamily ?? "n/a"
      })`,
      `Radar: ${
        discoveryStatus?.lastPollOk
          ? "OK"
          : discoveryStatus?.lastError
          ? `Error: ${discoveryStatus.lastError}`
          : "Idle"
      } (${discoveryStatus?.peerCount ?? 0} peers)`,
      `ICE state: ${diagnostics.iceState}`,
      `Gathering state: ${diagnostics.gatheringState}`,
      `Signaling state: ${diagnostics.signalingState}`,
      `Channel state: ${diagnostics.channelState}`,
      `Candidate counts: host=${diagnostics.candidateCounts.host}, srflx=${diagnostics.candidateCounts.srflx}, relay=${diagnostics.candidateCounts.relay}`,
      `Selected pair: ${
        diagnostics.selectedPair
          ? `local=${diagnostics.selectedPair.local}, remote=${diagnostics.selectedPair.remote}`
          : "none"
      }`,
      `Last error: ${diagnostics.lastError ?? "none"}`,
      "",
      "--- Debug Log ---",
    ];

    if (debugLog.length === 0) {
      lines.push("(no log entries)");
    } else {
      debugLog.forEach((entry) => {
        lines.push(`+${entry.t}ms: ${entry.msg}`);
      });
    }

    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = generateReport();
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <details
      onToggle={handleToggle}
      className="w-full text-xs text-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl bg-[var(--surface-subtle)]/50 p-2.5 transition-colors"
    >
      <summary className="cursor-pointer font-medium hover:text-[var(--text)] transition-colors select-none flex items-center justify-between">
        <span>Connection details</span>
      </summary>

      <div className="mt-3 space-y-2.5 border-t border-[var(--border-hairline)] pt-2.5 font-mono text-[11px]">
        {/* Server Storage */}
        <div>
          <span className="text-[var(--text-muted)]">Server storage: </span>
          <span className="font-semibold text-[var(--text)]">{storageMode ?? "loading..."}</span>
          {storageMode === "memory" && (
            <p className="text-amber-500 text-[10px] mt-0.5">
              Warning: memory storage is not shared between server instances
            </p>
          )}
        </div>

        {/* Network group */}
        <div>
          <span className="text-[var(--text-muted)]">Network group: </span>
          <span className="text-[var(--text)]">
            {discoveryStatus?.groupLabel ?? "n/a"} ({discoveryStatus?.ipFamily ?? "n/a"})
          </span>
        </div>

        {/* Radar */}
        <div>
          <span className="text-[var(--text-muted)]">Radar: </span>
          <span className="text-[var(--text)]">
            {discoveryStatus?.lastPollOk
              ? `OK (${discoveryStatus.peerCount} peers)`
              : discoveryStatus?.lastError
              ? `Error (${discoveryStatus.lastError})`
              : "Idle"}
          </span>
        </div>

        {/* WebRTC State Grid */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div>
            <span className="text-[var(--text-muted)]">ICE state: </span>
            <span className="text-[var(--text)] font-semibold">{diagnostics.iceState}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Gathering: </span>
            <span className="text-[var(--text)] font-semibold">{diagnostics.gatheringState}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Signaling: </span>
            <span className="text-[var(--text)] font-semibold">{diagnostics.signalingState}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Channel: </span>
            <span className="text-[var(--text)] font-semibold">{diagnostics.channelState}</span>
          </div>
        </div>

        {/* Candidates & Pair */}
        <div>
          <span className="text-[var(--text-muted)]">Candidates: </span>
          <span className="text-[var(--text)]">
            host {diagnostics.candidateCounts.host} | srflx {diagnostics.candidateCounts.srflx} | relay {diagnostics.candidateCounts.relay}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Selected pair: </span>
          <span className="text-[var(--text)]">
            {diagnostics.selectedPair
              ? `local ${diagnostics.selectedPair.local}, remote ${diagnostics.selectedPair.remote}`
              : "none"}
          </span>
        </div>

        {/* Last Error */}
        {diagnostics.lastError && (
          <div className="text-red-500">
            <span className="font-semibold">Last error: </span>
            <span>{diagnostics.lastError}</span>
          </div>
        )}

        {/* Debug Log */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Debug Log ({debugLog.length}/40)</span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-0.5 rounded border border-[var(--border-hairline)] bg-[var(--surface)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              {copied ? "Copied" : "Copy report"}
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto rounded bg-black/10 dark:bg-black/30 p-1.5 space-y-0.5 text-[10px] font-mono leading-tight">
            {debugLog.length === 0 ? (
              <div className="text-[var(--text-muted)] italic">(no log events yet)</div>
            ) : (
              debugLog.map((entry, idx) => (
                <div key={idx} className="text-[var(--text)]/80">
                  <span className="text-[var(--text-muted)]">+{entry.t}ms: </span>
                  <span>{entry.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
