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
  // Optional encrypted cloud relay payload (no encryption key is ever sent to or stored on server)
  relay?: {
    salt: string;
    createdAt: number;
    items: {
      url: string;
      pathname: string;
      name: string;
      size: number;
      mimeType: string;
      iv: string;
    }[];
    text?: {
      cipherText: string;
      iv: string;
    };
  };
}
