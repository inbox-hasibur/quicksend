export type TransferMode = "internet" | "same-network" | "hotspot" | "bluetooth" | "camera" | "cable";

export type TransferRole = "send" | "receive";

export interface ModeStatus {
  mode: TransferMode;
  name: string;
  tagline: string;
  description: string;
  isAvailable: boolean;
  disabledReason?: string;
  badge?: string;
  isOfflineCompatible: boolean;
}

export interface BrowserCapabilities {
  isOnline: boolean;
  hasWebShare: boolean;
  hasBluetooth: boolean;
}
