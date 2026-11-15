import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { NearbyShareCard } from "@/components/NearbyShareCard";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("NearbyShareCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("should render honest receiving guidance, neutral info box, and unsupported message when share is unavailable", async () => {
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    // Check title
    expect(container.textContent).toContain("Bluetooth & Quick Share");

    // Unsupported message is shown and share button is hidden when navigator.share is absent
    expect(container.textContent).toContain("Native Web Share is not supported in this browser");
    expect(container.textContent).not.toContain("Send via Quick Share / AirDrop / Bluetooth");

    // Check honest receiving guidance
    expect(container.textContent).toContain("How Receiving Works on this Device");
    expect(container.textContent).toContain("Quick Share");
    expect(container.textContent).toContain("AirDrop");

    // Check neutral info box text
    expect(container.textContent).toContain(
      "Browsers cannot scan or pair with other phones over Bluetooth. Quick Share and AirDrop do the nearby discovery for you. To send without internet, use Wi-Fi Hotspot mode."
    );

    // Check settings button
    expect(container.textContent).toContain("Open Bluetooth settings");
  });

  it("should have GATT section collapsed by default", async () => {
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    // Collapsed header title is visible
    expect(container.textContent).toContain("BLE hardware (sensors, microcontrollers)");

    // Inner content is not visible while collapsed
    expect(container.textContent).not.toContain("Phones will not appear here. Only devices that advertise over BLE are listed.");
    expect(container.textContent).not.toContain("Choose BLE device");
  });

  it("should toggle BLE Hardware section when clicked", async () => {
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    const toggleBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("BLE hardware (sensors, microcontrollers)")
    );
    expect(toggleBtn).toBeDefined();

    // Click to expand
    await act(async () => {
      toggleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("GATT Client");
    expect(container.textContent).toContain("Phones will not appear here. Only devices that advertise over BLE are listed.");
  });

  it("should call onOpenMode with hotspot and same-network ids when clicked", async () => {
    const onOpenMode = vi.fn();

    await act(async () => {
      root.render(<NearbyShareCard onOpenMode={onOpenMode} />);
    });

    const hotspotBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Open Wi-Fi Hotspot mode")
    );
    expect(hotspotBtn).toBeDefined();

    await act(async () => {
      hotspotBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenMode).toHaveBeenCalledWith("hotspot");

    const sameWifiBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Open Same Wi-Fi mode")
    );
    expect(sameWifiBtn).toBeDefined();

    await act(async () => {
      sameWifiBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenMode).toHaveBeenCalledWith("same-network");
  });
});
