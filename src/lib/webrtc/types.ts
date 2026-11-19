/**
 * WebRTC Shared Types and Constants
 */

export const BUFFER_THRESHOLD = 512 * 1024; // 512 KB backpressure threshold for smooth streaming

export const FIREWALL_BLOCKED_MESSAGE =
  "Blocked by 4G mobile network or firewall — TURN relay required";

export const ROOM_NOT_FOUND_MESSAGE =
  "Room not found / Sender offline";

export type ActiveTransport = "peerjs" | "webrtc" | null;

export interface CandidateCounts {
  host: number;
  srflx: number;
  relay: number;
}

export interface SelectedCandidatePair {
  local: string;
  remote: string;
}

export interface WebRTCDiagnostics {
  iceState: string;
  gatheringState: string;
  signalingState: string;
  channelState: string;
  candidateCounts: CandidateCounts;
  selectedPair: SelectedCandidatePair | null;
  lastError: string | null;
}

export interface DebugLogEntry {
  t: number;
  msg: string;
}

export interface DrainableChannel {
  bufferedAmount: number;
  bufferedAmountLowThreshold?: number;
  addEventListener?: (
    type: string,
    listener: (ev?: unknown) => void,
    options?: { once?: boolean }
  ) => void;
  removeEventListener?: (type: string, listener: (ev?: unknown) => void) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onbufferedamountlow?: ((this: any, ev: any) => any) | null;
}

export interface PeerJsConnection {
  open?: boolean;
  dataChannel?: RTCDataChannel;
  peerConnection?: RTCPeerConnection;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  send: (data: unknown) => void;
  close: () => void;
}

export interface PeerJsInstance {
  destroyed?: boolean;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  connect: (id: string, options?: unknown) => PeerJsConnection;
  destroy: () => void;
}

export function getInitialDiagnostics(): WebRTCDiagnostics {
  return {
    iceState: "new",
    gatheringState: "new",
    signalingState: "stable",
    channelState: "closed",
    candidateCounts: { host: 0, srflx: 0, relay: 0 },
    selectedPair: null,
    lastError: null,
  };
}
