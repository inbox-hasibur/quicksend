import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
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

    // Check collapsible fallback section
    expect(container.textContent).toContain("Can't see your device?");
  });

  it("should expand offline backup pairing when toggled", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    const summary = container.querySelector("summary");
    expect(summary?.textContent).toContain("Can't see your device?");

    expect(container.textContent).toContain("Use a nearby code");
    expect(container.textContent).toContain("Connect with PIN or QR");
    expect(container.textContent).toContain("Your Device PIN");
    expect(container.textContent).toContain("Connect to Another Device PIN");
  });
});
