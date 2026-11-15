import { describe, it, expect } from "vitest";
import {
  isModeAvailable,
  getModeStatus,
  getAllModesStatus,
} from "@/lib/modeAvailability";
import type { BrowserCapabilities } from "@/types/mode";

describe("modeAvailability logic", () => {
  const onlineFullCapabilities: BrowserCapabilities = {
    isOnline: true,
    hasWebShare: true,
    hasBluetooth: true,
  };

  const offlineCapabilities: BrowserCapabilities = {
    isOnline: false,
    hasWebShare: true,
    hasBluetooth: true,
  };

  const minimalBrowserCapabilities: BrowserCapabilities = {
    isOnline: true,
    hasWebShare: false,
    hasBluetooth: false,
  };

  describe("isModeAvailable", () => {
    it("should allow internet mode only when online", () => {
      expect(isModeAvailable("internet", onlineFullCapabilities)).toBe(true);
      expect(isModeAvailable("internet", offlineCapabilities)).toBe(false);
    });

    it("should always allow same-network mode regardless of internet connectivity", () => {
      expect(isModeAvailable("same-network", onlineFullCapabilities)).toBe(true);
      expect(isModeAvailable("same-network", offlineCapabilities)).toBe(true);
    });

    it("should always allow hotspot mode regardless of internet connectivity", () => {
      expect(isModeAvailable("hotspot", onlineFullCapabilities)).toBe(true);
      expect(isModeAvailable("hotspot", offlineCapabilities)).toBe(true);
    });

    it("should always allow camera mode regardless of internet connectivity", () => {
      expect(isModeAvailable("camera", onlineFullCapabilities)).toBe(true);
      expect(isModeAvailable("camera", offlineCapabilities)).toBe(true);
    });

    it("should always allow cable mode regardless of internet connectivity", () => {
      expect(isModeAvailable("cable", onlineFullCapabilities)).toBe(true);
      expect(isModeAvailable("cable", offlineCapabilities)).toBe(true);
    });

    it("should allow bluetooth mode if either Web Share or Web Bluetooth is supported", () => {
      expect(
        isModeAvailable("bluetooth", { isOnline: true, hasWebShare: true, hasBluetooth: false })
      ).toBe(true);
      expect(
        isModeAvailable("bluetooth", { isOnline: true, hasWebShare: false, hasBluetooth: true })
      ).toBe(true);
      expect(
        isModeAvailable("bluetooth", { isOnline: true, hasWebShare: false, hasBluetooth: false })
      ).toBe(false);
    });
  });

  describe("getModeStatus", () => {
    it("should disable internet mode with explanation when offline", () => {
      const status = getModeStatus("internet", offlineCapabilities);
      expect(status.isAvailable).toBe(false);
      expect(status.badge).toBe("Requires Internet");
      expect(status.disabledReason).toContain("Requires active Internet connection");
    });

    it("should enable internet mode with correct badge when online", () => {
      const status = getModeStatus("internet", onlineFullCapabilities);
      expect(status.isAvailable).toBe(true);
      expect(status.badge).toBe("Online WebRTC");
      expect(status.disabledReason).toBeUndefined();
    });

    it("should adapt same-network badge depending on online status", () => {
      const onlineStatus = getModeStatus("same-network", onlineFullCapabilities);
      expect(onlineStatus.badge).toBe("Local LAN WebRTC");

      const offlineStatus = getModeStatus("same-network", offlineCapabilities);
      expect(offlineStatus.badge).toBe("Offline LAN / QR Fallback");
    });

    it("should disable bluetooth mode when browser lacks both WebShare and BLE", () => {
      const status = getModeStatus("bluetooth", minimalBrowserCapabilities);
      expect(status.isAvailable).toBe(false);
      expect(status.badge).toBe("Unsupported Browser");
      expect(status.disabledReason).toContain("Browser lacks Web Bluetooth and Web Share API");
    });

    it("should provide Bluetooth name and Direct Radio / Share status badge", () => {
      const status = getModeStatus("bluetooth", onlineFullCapabilities);
      expect(status.name).toBe("Share via Bluetooth");
      expect(status.badge).toBe("Direct Radio / Share");
    });

    it("should provide optical stream badge for camera mode", () => {
      const status = getModeStatus("camera", offlineCapabilities);
      expect(status.isAvailable).toBe(true);
      expect(status.badge).toBe("100% Offline Optical");
    });

    it("should provide line speed badge for cable mode", () => {
      const status = getModeStatus("cable", offlineCapabilities);
      expect(status.isAvailable).toBe(true);
      expect(status.badge).toBe("Line Speed P2P");
    });
  });

  describe("getAllModesStatus", () => {
    it("should return all 6 transfer modes in expected order", () => {
      const allStatuses = getAllModesStatus(onlineFullCapabilities);
      expect(allStatuses).toHaveLength(6);
      expect(allStatuses.map((s) => s.mode)).toEqual([
        "internet",
        "same-network",
        "hotspot",
        "bluetooth",
        "camera",
        "cable",
      ]);
    });
  });
});
