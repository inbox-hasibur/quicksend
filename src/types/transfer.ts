export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

export interface TextMetadata {
  id: string;
  preview: string;
  length: number;
}

export type TransferItemType = "file" | "text";

export interface TransferPayloadHeader {
  type: TransferItemType;
  file?: FileMetadata;
  text?: TextMetadata;
  totalChunks: number;
  chunkSize: number;
}

export type TransferStatus =
  | "idle"
  | "connecting"
  | "waiting-acceptance"
  | "transferring"
  | "completed"
  | "rejected"
  | "error";

export interface TransferProgressState {
  status: TransferStatus;
  itemType: TransferItemType;
  fileName?: string;
  fileSize?: number;
  textPreview?: string;
  textContent?: string;
  bytesTransferred: number;
  totalBytes: number;
  progressPercentage: number;
  speedBps: number;
  errorMessage?: string;
}
