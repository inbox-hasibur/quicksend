import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { NearbyShareCard } from "@/components/NearbyShareCard";
import * as NearbyShareHook from "@/hooks/useNearbyShare";
import * as HistoryHook from "@/hooks/useTransferHistory";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("NearbyShareCard (Bluetooth Mode) Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  let mockNearbyShare: ReturnType<typeof NearbyShareHook.useNearbyShare>;
  const mockShareViaNative = vi.fn();
  const mockRequestBleDevice = vi.fn();
  const mockDisconnectBle = vi.fn();
  const mockAddHistoryItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockShareViaNative.mockResolvedValue(true);
    mockRequestBleDevice.mockResolvedValue(undefined);
    mockDisconnectBle.mockReturnValue(undefined);

    mockNearbyShare = {
      capabilities: { hasWebShare: true, canShareFiles: true, hasBluetooth: true },
      isSharing: false,
      shareSuccess: false,
      isConnectingBle: false,
      bleDevice: null,
      bleServices: [],
      errorMsg: null,
      clearError: vi.fn(),
      shareViaNative: mockShareViaNative,
      requestBleDevice: mockRequestBleDevice,
      disconnectBleDevice: mockDisconnectBle,
    };

    vi.spyOn(NearbyShareHook, "useNearbyShare").mockImplementation(() => mockNearbyShare);
    vi.spyOn(HistoryHook, "addTransferHistoryItem").mockImplementation(mockAddHistoryItem);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders Bluetooth title, subtitle, and Direct Radio / Share status badge", async () => {
    await act(async () => {
      root.render(React.createElement(NearbyShareCard));
    });

    expect(container.textContent).toContain("Bluetooth");
    expect(container.textContent).toContain("Send via system Bluetooth, Quick Share, or AirDrop");
    expect(container.textContent).toContain("Direct Radio / Share");
  });

  it("renders honest info card explaining browser Bluetooth boundaries and settings shortcut", async () => {
    await act(async () => {
      root.render(React.createElement(NearbyShareCard));
    });

    expect(container.textContent).toContain("How Receiving Works via Bluetooth");
    expect(container.textContent).toContain(
      "Web browsers cannot directly exchange files between two browser tabs over raw Bluetooth radio"
    );
    expect(container.textContent).toContain("Open Bluetooth settings");

    const settingsLink = container.querySelector("a[href*='settings.BLUETOOTH_SETTINGS']");
    expect(settingsLink).not.toBeNull();
  });

  it("displays fallback message when Web Share API is not supported", async () => {
    mockNearbyShare.capabilities.hasWebShare = false;

    await act(async () => {
      root.render(React.createElement(NearbyShareCard));
    });

    expect(container.textContent).toContain("Native Web Share is not supported in this browser");
  });

  it("renders disabled send button when no files or text are attached", async () => {
    await act(async () => {
      root.render(React.createElement(NearbyShareCard));
    });

    const sendBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Send via Bluetooth")
    ) as HTMLButtonElement;

    expect(sendBtn).toBeDefined();
    expect(sendBtn.disabled).toBe(true);
  });

  it("shows success alert when shareSuccess is true", async () => {
    mockNearbyShare.shareSuccess = true;

    await act(async () => {
      root.render(React.createElement(NearbyShareCard));
    });

    expect(container.textContent).toContain("Payload handed off to Native OS Share Sheet successfully!");
  });

  it("shows error alert when nativeErrorMsg is present", async () => {
    mockNearbyShare.errorMsg = "User cancelled share sheet.";

    await act(async () => {
      root.render(React.createElement(NearbyShareCard));
    });

    expect(container.textContent).toContain("User cancelled share sheet.");
  });

  it("renders collapsible BLE hardware section and handles scan click", async () => {
    await act(async () => {
      root.render(React.createElement(NearbyShareCard));
    });

    expect(container.textContent).toContain("Connect BLE Hardware (Sensors)");

    const scanBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Scan for BLE Device")
    );
    expect(scanBtn).toBeDefined();

    await act(async () => {
      scanBtn!.click();
    });

    expect(mockRequestBleDevice).toHaveBeenCalledTimes(1);
  });

  it("renders connected BLE device with GATT services and disconnect button", async () => {
    mockNearbyShare.bleDevice = {
      id: "ble-heart-rate-123",
      name: "Polar H10 Sensor",
      connected: true,
    };
    mockNearbyShare.bleServices = [
      { uuid: "0000180d-0000-1000-8000-00805f9b34fb", isPrimary: true, characteristics: ["00002a37"] },
    ];

    await act(async () => {
      root.render(React.createElement(NearbyShareCard));
    });

    expect(container.textContent).toContain("Polar H10 Sensor");
    expect(container.textContent).toContain("ID: ble-heart-rate-123");
    expect(container.textContent).toContain("0000180d-0000-1000-8000-00805f9b34fb");

    const disconnectBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Disconnect")
    );
    expect(disconnectBtn).toBeDefined();

    await act(async () => {
      disconnectBtn!.click();
    });

    expect(mockDisconnectBle).toHaveBeenCalledTimes(1);
  });
});
