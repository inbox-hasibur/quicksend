import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

  it("should render honest 1-tap device share and receiving guidance", async () => {
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    // Check title & primary CTA
    expect(container.textContent).toContain("Bluetooth & Quick Share");
    expect(container.textContent).toContain("Send via Quick Share / AirDrop / Bluetooth");

    // Check honest receiving guidance
    expect(container.textContent).toContain("How Receiving Works on this Device");
    expect(container.textContent).toContain("Quick Share");
    expect(container.textContent).toContain("AirDrop");

    // Check secondary collapsible hardware section
    expect(container.textContent).toContain("Connect BLE Device (Sensors / Hardware)");
  });

  it("should toggle BLE Hardware section when clicked", async () => {
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    const toggleBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Connect BLE Device (Sensors / Hardware)")
    );
    expect(toggleBtn).toBeDefined();

    // Click to expand
    await act(async () => {
      toggleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("GATT Client");
  });
});
