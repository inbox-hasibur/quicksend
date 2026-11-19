import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { SameNetworkCard } from "@/components/SameNetworkCard";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SameNetworkCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, peers: [], networkId: "local-lan" }),
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

  it("should render Send mode Step 1 by default without showing radar or connection diagnostics", async () => {
    await act(async () => {
      root.render(<SameNetworkCard />);
    });

    expect(container.textContent).toContain("Same Wi-Fi");
    expect(container.textContent).toContain("Send files directly to nearby devices on this Wi-Fi");
    expect(container.textContent).toContain("Find Devices");
    // Should NOT show radar on Step 1
    expect(container.textContent).not.toContain("Discovered Devices");
    expect(container.textContent).not.toContain("Advanced Network Diagnostics");
  });

  it("should switch to Receive tab and render radar with waiting state", async () => {
    await act(async () => {
      root.render(<SameNetworkCard />);
    });

    const receiveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Receive"
    );
    expect(receiveBtn).toBeDefined();

    await act(async () => {
      receiveBtn?.click();
    });

    expect(container.textContent).toContain("Receive files directly from nearby devices on this Wi-Fi");
    expect(container.textContent).toContain("Waiting for nearby sender on Wi-Fi...");
    expect(container.textContent).toContain("Connect with PIN or Scan QR");
  });

  it("should swap to direct connect fallback when clicking bottom link", async () => {
    await act(async () => {
      root.render(<SameNetworkCard />);
    });

    // Switch to receive
    const receiveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Receive"
    );
    await act(async () => {
      receiveBtn?.click();
    });

    const fallbackLink = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Connect with PIN or Scan QR"
    );
    expect(fallbackLink).toBeDefined();

    await act(async () => {
      fallbackLink?.click();
    });

    expect(container.textContent).toContain("Direct PIN & QR Connect");
    expect(container.textContent).toContain("Option 1: Subnet / CGNAT Pairing Code");
    expect(container.textContent).toContain("Option 2: 6-Digit PIN or Camera QR");
    expect(container.textContent).toContain("Back to Radar");

    // Click back to radar
    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Back to Radar"
    );
    await act(async () => {
      backBtn?.click();
    });

    expect(container.textContent).toContain("Waiting for nearby sender on Wi-Fi...");
  });
});
