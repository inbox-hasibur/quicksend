import type { PeerRole } from "@/types/signaling";
import {
  FIREWALL_BLOCKED_MESSAGE,
  type PeerJsConnection,
  type PeerJsInstance,
} from "./types";

/**
 * Lazy loads the PeerJS client library constructor.
 */
export async function loadPeerConstructor(): Promise<(new (
  id?: string,
  options?: unknown
) => PeerJsInstance) | null> {
  try {
    const m = await import("peerjs");
    const mod = (m && (m as { default?: unknown }).default ? (m as { default: unknown }).default : m) as Record<
      string,
      unknown
    >;
    const PeerClass = (mod.Peer || mod.default || mod) as new (
      id?: string,
      options?: unknown
    ) => PeerJsInstance;
    return typeof PeerClass === "function" ? PeerClass : null;
  } catch {
    return null;
  }
}

/**
 * Normalizes room code to canonical PeerJS peer ID.
 */
export function formatPeerJsId(roomCode: string): string {
  return `qs-v2-${roomCode.toLowerCase()}`;
}

export interface PeerConnectionCallbacks {
  addLog: (msg: string) => void;
  onIceStateChange: (state: string) => void;
  onCandidate: (type: "host" | "srflx" | "relay") => void;
  startHandshakeWatchdog: (role: PeerRole) => void;
  clearHandshakeWatchdog: () => void;
  clearReceiverWatchdogs: () => void;
  onFirewallBlocked: (errMsg: string) => void;
}

/**
 * Wires PeerJS's internal RTCPeerConnection to ICE watchdog and live diagnostics.
 */
export function wirePeerConnectionEvents(
  pc: RTCPeerConnection | undefined | null,
  currentRole: PeerRole,
  callbacks: PeerConnectionCallbacks
): void {
  if (!pc) return;
  try {
    const updateIce = () => {
      const state = pc.iceConnectionState;
      callbacks.addLog(`PeerJS internal ICE state: ${state}`);
      callbacks.onIceStateChange(state);
      if (state === "checking") {
        callbacks.startHandshakeWatchdog(currentRole);
      } else if (state === "connected" || state === "completed") {
        callbacks.clearHandshakeWatchdog();
        callbacks.clearReceiverWatchdogs();
      } else if (state === "failed") {
        callbacks.clearHandshakeWatchdog();
        callbacks.clearReceiverWatchdogs();
        callbacks.onFirewallBlocked(FIREWALL_BLOCKED_MESSAGE);
      }
    };

    pc.addEventListener("iceconnectionstatechange", updateIce);
    pc.addEventListener("icecandidate", (e) => {
      if (e.candidate) {
        const type = e.candidate.type as "host" | "srflx" | "relay";
        if (type && (type === "host" || type === "srflx" || type === "relay")) {
          callbacks.onCandidate(type);
        }
      }
    });

    if (pc.iceConnectionState) {
      updateIce();
    }
  } catch (err) {
    console.debug("Failed to wire PeerJS internal peerConnection:", err);
  }
}

export interface PeerJsSenderCallbacks {
  dynamicConfig: RTCConfiguration;
  onConnection: (conn: PeerJsConnection) => void;
  onError: (errorType: string) => void;
}

/**
 * Instantiates a PeerJS sender listening on `qs-v2-<roomCode>`.
 */
export function createPeerJsSender(
  PeerClass: new (id?: string, options?: unknown) => PeerJsInstance,
  roomCode: string,
  callbacks: PeerJsSenderCallbacks
): PeerJsInstance {
  const peerId = formatPeerJsId(roomCode);
  const peer = new PeerClass(peerId, {
    config: callbacks.dynamicConfig,
    debug: 1,
  });

  peer.on("connection", (rawConn: unknown) => {
    callbacks.onConnection(rawConn as PeerJsConnection);
  });

  peer.on("error", (err: unknown) => {
    const e = err as { type?: string };
    callbacks.onError(e?.type || "broker-error");
  });

  return peer;
}

export interface PeerJsReceiverCallbacks {
  dynamicConfig: RTCConfiguration;
  onConnection: (conn: PeerJsConnection) => void;
  onNotice: (type: string) => void;
  isSessionActive: () => boolean;
}

/**
 * Instantiates a PeerJS receiver and attempts connection to `qs-v2-<cleanCode>` with automatic retry.
 */
export function createPeerJsReceiver(
  PeerClass: new (id?: string, options?: unknown) => PeerJsInstance,
  cleanCode: string,
  callbacks: PeerJsReceiverCallbacks
): { peer: PeerJsInstance; cleanup: () => void } {
  const peer = new PeerClass(undefined, {
    config: callbacks.dynamicConfig,
    debug: 1,
  });

  const targetId = formatPeerJsId(cleanCode);
  let retryTimer: NodeJS.Timeout | null = null;

  const connectToSender = () => {
    if (!callbacks.isSessionActive() || !peer || peer.destroyed) return;
    try {
      const conn = peer.connect(targetId, {
        reliable: true,
        serialization: "raw",
      });
      callbacks.onConnection(conn);
    } catch (err) {
      console.debug("PeerJS receiver connect exception:", err);
    }
  };

  peer.on("open", () => {
    connectToSender();
  });

  peer.on("error", (err: unknown) => {
    const e = err as { type?: string };
    const errorType = e?.type || "broker-error";
    callbacks.onNotice(errorType);
    if (errorType === "peer-unavailable" && callbacks.isSessionActive()) {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (callbacks.isSessionActive()) {
          connectToSender();
        }
      }, 1500);
    }
  });

  return {
    peer,
    cleanup: () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    },
  };
}
