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
  // Batch queue metadata
  batchId?: string;
  fileIndex?: number;
  totalFiles?: number;
  totalBatchBytes?: number;
  // Integrity checksum
  sha256?: string;
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
  // Batch queue progress
  batchId?: string;
  fileIndex?: number;
  totalFiles?: number;
  totalBatchBytes?: number;
  batchBytesTransferred?: number;
  // Integrity verification
  sha256?: string;
  isVerified?: boolean;
}

export interface TransferHistoryItem {
  id: string;
  timestamp: number;
  direction: "sent" | "received";
  mode: string;
  itemType: TransferItemType;
  name: string;
  size?: number;
  textSnippet?: string;
  status: "completed" | "failed";
}
