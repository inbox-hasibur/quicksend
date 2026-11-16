import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { RadarPanel, type RadarIdentity } from "@/components/RadarPanel";
import type { NearbyPeer } from "@/hooks/useLocalDiscovery";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("RadarPanel Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockIdentity: RadarIdentity = {
    name: "MacBook Pro",
    codename: "Cosmic Fox",
    avatarEmoji: "🦊",
    avatarColor: "#6366F1",
    os: "macOS",
    browser: "Chrome",
    formFactor: "laptop",
  };

  const mockPeers: NearbyPeer[] = [
    {
      id: "peer-1",
      peerId: "p1",
      name: "Pixel 9",
      codename: "Solar Falcon",
      avatarEmoji: "🦅",
      avatarColor: "#10B981",
      os: "Android",
      browser: "Chrome",
      formFactor: "mobile",
      lastSeen: Date.now(),
    },
    {
      id: "peer-2",
      peerId: "p2",
      name: "iPad Air",
      codename: "Lunar Wolf",
      avatarEmoji: "🐺",
      avatarColor: "#EC4899",
      os: "iOS",
      browser: "Safari",
      formFactor: "tablet",
      lastSeen: Date.now(),
    },
  ];

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

  it("renders empty radar state with identity and scanning status", async () => {
    const onChangeAvatar = vi.fn();
    const onBeam = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(RadarPanel, {
          title: "Nearby Wi-Fi Radar (0)",
          statusText: "Scanning local subnet...",
          emptyText: "No devices found nearby.",
          myIdentity: mockIdentity,
          peers: [],
          onBeam,
          onChangeAvatar,
        })
      );
    });

    expect(container.textContent).toContain("Nearby Wi-Fi Radar (0)");
    expect(container.textContent).toContain("Scanning local subnet...");
    expect(container.textContent).toContain("Cosmic Fox");
    expect(container.textContent).toContain("You (macOS • Chrome)");
    expect(container.textContent).toContain("No devices found nearby.");
    expect(container.textContent).toContain("🦊");

    // Click change avatar button
    const changeBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Change avatar")
    );
    expect(changeBtn).toBeDefined();

    await act(async () => {
      changeBtn!.click();
    });
    expect(onChangeAvatar).toHaveBeenCalledTimes(1);
  });

  it("renders peers on radar and fires onBeam callback when tapped", async () => {
    const onBeam = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(RadarPanel, {
          title: "Discovered Devices (2)",
          statusText: "Synced",
          myIdentity: mockIdentity,
          peers: mockPeers,
          selectedPeerId: "peer-1",
          onBeam,
        })
      );
    });

    expect(container.textContent).toContain("Solar Falcon");
    expect(container.textContent).toContain("Lunar Wolf");
    expect(container.textContent).toContain("Android (Chrome)");
    expect(container.textContent).toContain("iOS (Safari)");

    // Click peer-2 node
    const peerButtons = Array.from(container.querySelectorAll("button")).filter((btn) =>
      btn.textContent?.includes("Tap to Send")
    );
    expect(peerButtons.length).toBe(2);

    await act(async () => {
      peerButtons[1].click();
    });

    expect(onBeam).toHaveBeenCalledWith(mockPeers[1]);
  });

  it("renders error message and custom banner if provided", async () => {
    await act(async () => {
      root.render(
        React.createElement(RadarPanel, {
          myIdentity: mockIdentity,
          peers: [],
          onBeam: vi.fn(),
          error: "Connection firewall blocked UDP packet.",
          banner: React.createElement("div", { id: "custom-banner" }, "Custom Beam Banner"),
        })
      );
    });

    expect(container.textContent).toContain("Connection firewall blocked UDP packet.");
    expect(container.textContent).toContain("Custom Beam Banner");
  });
});
