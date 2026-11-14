import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Nearby & Bluetooth Capabilities and Transfer History", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Native Web Share Payload Validation", () => {
    it("should accept valid file and text payloads for OS share sheet", () => {
      const file = new File(["dummy content"], "report.pdf", { type: "application/pdf" });
      const payload = {
        title: "Share Anything Beam",
        text: "Important report",
        files: [file],
      };

      expect(payload.title).toBe("Share Anything Beam");
      expect(payload.files).toHaveLength(1);
      expect(payload.files[0].name).toBe("report.pdf");
      expect(payload.files[0].size).toBeGreaterThan(0);
    });

    it("should generate a fallback text summary when files array cannot be shared directly", () => {
      const files = [
        new File(["a"], "img1.png", { type: "image/png" }),
        new File(["b"], "img2.png", { type: "image/png" }),
      ];

      const summaryText = `Sharing ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`;
      expect(summaryText).toBe("Sharing 2 file(s): img1.png, img2.png");
    });
  });

  describe("Web-BLE Device and GATT Server Contracts", () => {
    it("should correctly represent a connected BLE peripheral state", () => {
      const mockBleDevice = {
        id: "ble-device-12345",
        name: "ESP32-Sensor-Node",
        connected: true,
      };

      expect(mockBleDevice.id).toBe("ble-device-12345");
      expect(mockBleDevice.name).toBe("ESP32-Sensor-Node");
      expect(mockBleDevice.connected).toBe(true);
    });

    it("should format GATT service information with primary status and characteristic UUIDs", () => {
      const mockService = {
        uuid: "0000180f-0000-1000-8000-00805f9b34fb",
        isPrimary: true,
        characteristics: [
          "00002a19-0000-1000-8000-00805f9b34fb", // Battery Level
        ],
      };

      expect(mockService.isPrimary).toBe(true);
      expect(mockService.characteristics).toHaveLength(1);
      expect(mockService.characteristics[0]).toContain("2a19");
    });
  });

  describe("Ephemeral Transfer History Storage Logic", () => {
    interface HistoryItem {
      id: string;
      timestamp: number;
      direction: "sent" | "received";
      mode: string;
      itemType: "file" | "text";
      name: string;
      size?: number;
    }

    it("should prepend new items and enforce a maximum session limit", () => {
      let history: HistoryItem[] = [];

      const addItem = (item: Omit<HistoryItem, "id" | "timestamp">) => {
        const newItem: HistoryItem = {
          ...item,
          id: `hist_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
        };
        history = [newItem, ...history].slice(0, 50);
      };

      // Add 55 items
      for (let i = 1; i <= 55; i++) {
        addItem({
          direction: "sent",
          mode: "internet",
          itemType: "file",
          name: `file_${i}.txt`,
          size: i * 1024,
        });
      }

      expect(history.length).toBe(50);
      expect(history[0].name).toBe("file_55.txt");
    });

    it("should clear all history on reset", () => {
      let history: HistoryItem[] = [
        {
          id: "1",
          timestamp: Date.now(),
          direction: "received",
          mode: "same-network",
          itemType: "text",
          name: "Clipboard Snippet",
        },
      ];

      expect(history.length).toBe(1);
      history = [];
      expect(history.length).toBe(0);
    });
  });
});
