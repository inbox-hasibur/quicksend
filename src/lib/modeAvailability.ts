import type { BrowserCapabilities, ModeStatus, TransferMode } from "@/types/mode";

/**
 * Evaluates whether a specific transfer mode can be used given the current browser capabilities.
 */
export function isModeAvailable(mode: TransferMode, capabilities: BrowserCapabilities): boolean {
  switch (mode) {
    case "internet":
      return capabilities.isOnline;
    case "same-network":
      // Always available: uses local LAN signaling when online, or camera optical QR handshake when offline
      return true;
    case "hotspot":
      // Always available: standalone offline transfer interface powered by cached PWA + Wi-Fi QR
      return true;
    case "bluetooth":
      // Available if browser supports Web Bluetooth GATT client OR Web Share API (Quick Share / AirDrop)
      return capabilities.hasWebShare || capabilities.hasBluetooth;
    case "camera":
      // Always available: camera-to-screen optical transfer works completely offline without network
      return true;
    case "cable":
      // Always available: direct link-local Ethernet / USB-C link or WebUSB/WebSerial
      return true;
    default:
      return false;
  }
}

/**
 * Returns complete presentation metadata and availability state for a specific transfer mode.
 */
export function getModeStatus(mode: TransferMode, capabilities: BrowserCapabilities): ModeStatus {
  switch (mode) {
    case "internet": {
      const isAvailable = capabilities.isOnline;
      return {
        mode: "internet",
        name: "Share via Internet",
        tagline: "Remote P2P Relay",
        description: "Connect devices across any network via an ephemeral 6-digit PIN or dynamic QR code.",
        isAvailable,
        disabledReason: isAvailable
          ? undefined
          : "Requires active Internet connection to coordinate room signaling.",
        badge: isAvailable ? "Online WebRTC" : "Requires Internet",
        isOfflineCompatible: false,
      };
    }
    case "same-network": {
      return {
        mode: "same-network",
        name: "Share via Same Network",
        tagline: "High-Speed Local Wi-Fi",
        description: "Direct high-throughput LAN transfer over shared Wi-Fi or router subnet.",
        isAvailable: true,
        badge: capabilities.isOnline ? "Local LAN WebRTC" : "Offline LAN / QR Fallback",
        isOfflineCompatible: true,
      };
    }
    case "hotspot": {
      return {
        mode: "hotspot",
        name: "Share via Wi-Fi + Hotspot",
        tagline: "Offline AP Interface",
        description: "Zero-internet transfer assistant using mobile hotspot, QR credentials, and offline PWA.",
        isAvailable: true,
        badge: "Offline PWA & QR",
        isOfflineCompatible: true,
      };
    }
    case "bluetooth": {
      const isAvailable = capabilities.hasWebShare || capabilities.hasBluetooth;
      let badge = "Direct Radio / Share";
      if (!isAvailable) {
        badge = "Unsupported Browser";
      }

      return {
        mode: "bluetooth",
        name: "Share via Bluetooth",
        tagline: "System Bluetooth & Quick Share",
        description: "Send files via system Bluetooth, Quick Share, or AirDrop with hardware BLE support.",
        isAvailable,
        disabledReason: isAvailable
          ? undefined
          : "Browser lacks Web Bluetooth and Web Share API support. Use Chrome or Edge on Android/Desktop.",
        badge,
        isOfflineCompatible: true,
      };
    }
    case "camera": {
      return {
        mode: "camera",
        name: "Via Camera Scan",
        tagline: "Air-Gapped Optical Stream",
        description: "Zero network transfer. Stream files as animated QR codes scanned by opposite device camera.",
        isAvailable: true,
        badge: "100% Offline Optical",
        isOfflineCompatible: true,
      };
    }
    case "cable": {
      return {
        mode: "cable",
        name: "Via Cable",
        tagline: "Direct USB / Ethernet",
        description: "Maximum line-speed transfer over a direct USB-C, Ethernet, or USB tethering cable.",
        isAvailable: true,
        badge: "Line Speed P2P",
        isOfflineCompatible: true,
      };
    }
  }
}

/**
 * Returns availability status for all transfer modes in display order.
 */
export function getAllModesStatus(capabilities: BrowserCapabilities): ModeStatus[] {
  const modes: TransferMode[] = ["internet", "same-network", "hotspot", "bluetooth", "camera", "cable"];
  return modes.map((mode) => getModeStatus(mode, capabilities));
}
