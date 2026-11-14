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
      let badge = "Nearby BLE / Quick Share";
      if (!isAvailable) {
        badge = "Unsupported Browser";
      } else if (capabilities.hasBluetooth && !capabilities.hasWebShare) {
        badge = "Web Bluetooth BLE";
      } else if (!capabilities.hasBluetooth && capabilities.hasWebShare) {
        badge = "Quick Share / AirDrop";
      }

      return {
        mode: "bluetooth",
        name: "Share via Bluetooth",
        tagline: "Nearby Proximity Transfer",
        description: "Quick Share, AirDrop, and Web-BLE GATT client interface for nearby devices.",
        isAvailable,
        disabledReason: isAvailable
          ? undefined
          : "Browser lacks Web Bluetooth and Web Share API support. Use Chrome or Edge on Android/Desktop.",
        badge,
        isOfflineCompatible: true,
      };
    }
  }
}

/**
 * Returns availability status for all 4 transfer modes in display order.
 */
export function getAllModesStatus(capabilities: BrowserCapabilities): ModeStatus[] {
  const modes: TransferMode[] = ["internet", "same-network", "hotspot", "bluetooth"];
  return modes.map((mode) => getModeStatus(mode, capabilities));
}
