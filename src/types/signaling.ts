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
    // Chunk-based relay metadata (no encryption key is stored on server)
    rid?: string;
    baseUrl?: string;
    files?: {
      id: string;
      name: string;
      size: number;
      mimeType: string;
      chunkCount: number;
      ivPrefix: string;
    }[];
    // Legacy single-blob relay fields (kept for backward compatibility)
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
