import type { PeerRole } from "@/types/signaling";
import type { DebugLogEntry, SelectedCandidatePair } from "./types";

/**
 * Appends a log entry to the fixed-size ring buffer (default 40 items).
 */
export function appendDebugLog(
  prev: DebugLogEntry[],
  msg: string,
  startTime: number,
  maxEntries = 40
): DebugLogEntry[] {
  const t = startTime > 0 ? Math.max(0, Date.now() - startTime) : 0;
  const next = [...prev, { t, msg }];
  return next.length > maxEntries ? next.slice(-maxEntries) : next;
}

/**
 * Parses ICE candidate type ('host' | 'srflx' | 'relay') from candidate string or fallback.
 */
export function parseCandidateType(candidateStr: string, fallbackType = "unknown"): string {
  const match = candidateStr.match(/typ\s+(\w+)/);
  return match ? match[1] : fallbackType;
}

/**
 * Inspects selected/active candidate pair via pc.getStats().
 */
export async function inspectSelectedCandidatePair(
  pc: RTCPeerConnection
): Promise<SelectedCandidatePair | null> {
  if (typeof pc.getStats !== "function") return null;

  try {
    const stats = await pc.getStats();
    let localCandidateId: string | undefined;
    let remoteCandidateId: string | undefined;

    stats.forEach((report: Record<string, unknown>) => {
      if (report.type === "transport" && report.selectedCandidatePairId) {
        const pair = stats.get(report.selectedCandidatePairId as string) as
          | Record<string, unknown>
          | undefined;
        if (pair) {
          localCandidateId = pair.localCandidateId as string | undefined;
          remoteCandidateId = pair.remoteCandidateId as string | undefined;
        }
      }
    });

    if (!localCandidateId || !remoteCandidateId) {
      stats.forEach((report: Record<string, unknown>) => {
        if (
          report.type === "candidate-pair" &&
          (report.selected || (report.nominated && report.state === "succeeded"))
        ) {
          localCandidateId = report.localCandidateId as string | undefined;
          remoteCandidateId = report.remoteCandidateId as string | undefined;
        }
      });
    }

    if (localCandidateId && remoteCandidateId) {
      const localCand = stats.get(localCandidateId) as Record<string, unknown> | undefined;
      const remoteCand = stats.get(remoteCandidateId) as Record<string, unknown> | undefined;
      if (localCand && remoteCand) {
        const local = (localCand.candidateType || localCand.type || "unknown") as string;
        const remote = (remoteCand.candidateType || remoteCand.type || "unknown") as string;
        return { local, remote };
      }
    }
  } catch {
    // Ignore stats inspection failure
  }

  return null;
}

export interface WatchdogCallbacks {
  onRestartIce: () => void;
  onTimeout: () => void;
  addLog: (msg: string) => void;
  isActive: () => boolean;
}

/**
 * Manages 15s ICE handshake watchdog with automatic restartIce around 7s.
 */
export function createHandshakeWatchdogManager(callbacks: WatchdogCallbacks) {
  let restartTimer: NodeJS.Timeout | null = null;
  let watchdogTimer: NodeJS.Timeout | null = null;

  const start = () => {
    if (watchdogTimer || !callbacks.isActive()) return;
    callbacks.addLog("Handshake initiated: starting 15s ICE watchdog (restartIce at 7s)");

    restartTimer = setTimeout(() => {
      if (!callbacks.isActive()) return;
      callbacks.onRestartIce();
    }, 7000);

    watchdogTimer = setTimeout(() => {
      if (!callbacks.isActive()) return;
      callbacks.onTimeout();
    }, 15000);
  };

  const clear = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  };

  return { start, clear };
}

export interface RtcListenersCallbacks {
  currentRole: PeerRole;
  addLog: (msg: string) => void;
  onCandidate: (type: "host" | "srflx" | "relay", candidate: RTCIceCandidate) => void;
  onIceChecking: () => void;
  onIceConnected: () => void;
  onIceFailed: () => void;
  onIceStateChange: (state: RTCIceConnectionState) => void;
  onGatheringStateChange: (state: RTCIceGatheringState) => void;
  onSignalingStateChange: (state: RTCSignalingState) => void;
  onConnectionConnected: () => void;
  onConnectionFailed: () => void;
  onConnectionDisconnected: () => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
}

/**
 * Attaches standard WebRTC peer connection event listeners.
 */
export function setupRtcPeerConnectionListeners(
  pc: RTCPeerConnection,
  callbacks: RtcListenersCallbacks
): void {
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candType = parseCandidateType(
        event.candidate.candidate || "",
        event.candidate.type || "unknown"
      );
      callbacks.addLog(`Local candidate: ${candType}`);
      if (candType === "host" || candType === "srflx" || candType === "relay") {
        callbacks.onCandidate(candType, event.candidate);
      }
    }
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    callbacks.addLog(`ICE state: ${state}`);
    callbacks.onIceStateChange(state);

    if (state === "checking") {
      callbacks.onIceChecking();
    } else if (state === "connected" || state === "completed") {
      callbacks.onIceConnected();
    } else if (state === "failed") {
      callbacks.onIceFailed();
    }
  };

  pc.onicegatheringstatechange = () => {
    callbacks.addLog(`Gathering state: ${pc.iceGatheringState}`);
    callbacks.onGatheringStateChange(pc.iceGatheringState);
  };

  pc.onsignalingstatechange = () => {
    callbacks.addLog(`Signaling state: ${pc.signalingState}`);
    callbacks.onSignalingStateChange(pc.signalingState);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      callbacks.onConnectionConnected();
    } else if (pc.connectionState === "failed") {
      callbacks.onConnectionFailed();
    } else if (pc.connectionState === "disconnected" || pc.connectionState === "closed") {
      callbacks.onConnectionDisconnected();
    }
  };

  if (callbacks.currentRole === "receiver" && callbacks.onDataChannel) {
    pc.ondatachannel = (event) => {
      callbacks.onDataChannel!(event.channel);
    };
  }
}
