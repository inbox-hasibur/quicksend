import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { HotspotAssistantCard } from "@/components/HotspotAssistantCard";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("HotspotAssistantCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ peers: [], networkId: "local-lan" }),
      })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("should render live radar, host/join tabs, and offline backup section", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    // Check title and setup steps
    expect(container.textContent).toContain("Wi-Fi Hotspot");
    expect(container.textContent).toContain("Host Hotspot");
    expect(container.textContent).toContain("Join Hotspot");

    // Check live radar screen
    expect(container.textContent).toContain("Devices on this Hotspot");
    expect(container.textContent).toContain("Scanning hotspot...");

    // Check collapsible offline backup
    expect(container.textContent).toContain("No mobile data? Use Offline Direct PIN / QR Pairing");
  });

  it("should expand offline backup pairing when toggled", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    const toggleBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("No mobile data? Use Offline Direct PIN / QR Pairing")
    );
    expect(toggleBtn).toBeDefined();

    // Click to expand offline backup
    await act(async () => {
      toggleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Your Device PIN");
    expect(container.textContent).toContain("Connect to Another Device PIN");
  });
});
