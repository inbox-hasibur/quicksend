export type PeerRole = "sender" | "receiver";

export type SignalPayloadType =
  | "peer-joined"
  | "offer"
  | "answer"
  | "candidate"
  | "file-ready"
  | "transfer-accepted"
  | "transfer-rejected"
  | "transfer-cancelled";

export interface SignalMessage {
  id: string;
  roomId: string;
  senderRole: PeerRole;
  targetRole: PeerRole;
  type: SignalPayloadType;
  payload?: unknown;
  timestamp: number;
}

export interface SignalingRoomState {
  roomId: string;
  code: string;
  createdAt: number;
  senderJoined: boolean;
  receiverJoined: boolean;
  messages: SignalMessage[];
}
