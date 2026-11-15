import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { NearbyShareCard } from "@/components/NearbyShareCard";
import * as LocalDiscoveryHook from "@/hooks/useLocalDiscovery";
import * as WebRTCHook from "@/hooks/useWebRTC";
import * as NetworkStatusHook from "@/hooks/useNetworkStatus";
import * as NearbyShareHook from "@/hooks/useNearbyShare";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("NearbyShareCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  let mockDiscovery: ReturnType<typeof LocalDiscoveryHook.useLocalDiscovery>;
  let mockWebRTC: ReturnType<typeof WebRTCHook.useWebRTC>;
  let mockIsOnline = true;
  let mockNearbyShare: ReturnType<typeof NearbyShareHook.useNearbyShare>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mockDiscovery = {
      profile: {
        id: "dev_local_1",
        name: "My Pixel",
        codename: "Cosmic Fox",
        avatarEmoji: "🦊",
        avatarColor: "bg-orange-500/10 text-orange-600",
        formFactor: "mobile",
        os: "Android",
        browser: "Chrome",
      },
      peers: [],
      networkId: "local-lan",
      incomingBeam: null,
      beamToPeer: vi.fn().mockResolvedValue(undefined),
      clearIncomingBeam: vi.fn().mockResolvedValue(undefined),
      pin: "4321",
      lookupPin: vi.fn().mockResolvedValue(null),
      isScanning: true,
      updateName: vi.fn(),
      cycleAvatar: vi.fn(),
      refreshPeers: vi.fn().mockResolvedValue(undefined),
      status: {
        lastPollOk: true,
        lastPollAt: Date.now(),
        lastError: null,
        peerCount: 0,
        groupLabel: "local-lan",
        ipFamily: "IPv4",
      },
    };

    mockWebRTC = {
      role: null,
      roomId: null,
      roomCode: null,
      isConnected: false,
      progress: {
        status: "idle",
        itemType: "file",
        bytesTransferred: 0,
        totalBytes: 0,
        progressPercentage: 0,
        speedBps: 0,
      },
      pendingHeader: null,
      startSender: vi.fn().mockResolvedValue(undefined),
      startReceiver: vi.fn().mockResolvedValue(undefined),
      sendFiles: vi.fn().mockResolvedValue(undefined),
      sendText: vi.fn().mockResolvedValue(undefined),
      sendPayload: vi.fn().mockResolvedValue(undefined),
      acceptIncomingTransfer: vi.fn(),
      rejectIncomingTransfer: vi.fn(),
      cleanup: vi.fn(),
      debugLog: [],
      diagnostics: {
        iceState: "new",
        gatheringState: "new",
        signalingState: "stable",
        channelState: "closed",
        candidateCounts: { host: 0, srflx: 0, relay: 0 },
        selectedPair: null,
        lastError: null,
      },
    };

    mockIsOnline = true;

    mockNearbyShare = {
      capabilities: { hasWebShare: false, canShareFiles: false, hasBluetooth: false },
      isSharing: false,
      shareSuccess: false,
      isConnectingBle: false,
      bleDevice: null,
      bleServices: [],
      shareViaNative: vi.fn().mockResolvedValue(true),
      requestBleDevice: vi.fn(),
      disconnectBleDevice: vi.fn(),
      errorMsg: null,
      clearError: vi.fn(),
    };

    vi.spyOn(LocalDiscoveryHook, "useLocalDiscovery").mockImplementation(() => mockDiscovery);
    vi.spyOn(WebRTCHook, "useWebRTC").mockImplementation(() => mockWebRTC);
    vi.spyOn(NetworkStatusHook, "useNetworkStatus").mockImplementation(() => mockIsOnline);
    vi.spyOn(NearbyShareHook, "useNearbyShare").mockImplementation(() => mockNearbyShare);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders heading 'Nearby Pair' and status badge 'Pair online, share offline'", async () => {
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    expect(container.textContent).toContain("Nearby Pair");
    expect(container.textContent).toContain("Tap a nearby device or enter a PIN. Send after they accept.");
    expect(container.textContent).toContain("Pair online, share offline");
  });

  it("idle view shows PIN and empty text when no peers are found", async () => {
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    expect(container.textContent).toContain("4321");
    expect(container.textContent).toContain(
      "Looking for nearby devices... Make sure QuickSend is open on the other device."
    );
  });

  it("renders peers as cards and clicking a peer calls startSender then beamToPeer", async () => {
    mockDiscovery.peers = [
      {
        id: "dev_peer_2",
        name: "Alice iPad",
        avatarEmoji: "🐱",
        avatarColor: "bg-blue-500/10 text-blue-600",
        os: "iPadOS",
        formFactor: "tablet",
        peerId: "p2",
        lastSeen: Date.now(),
      },
    ];

    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    expect(container.textContent).toContain("Alice iPad");
    expect(container.textContent).toContain("iPadOS");

    const peerButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Alice iPad")
    );
    expect(peerButton).toBeDefined();

    await act(async () => {
      peerButton?.click();
    });

    expect(mockWebRTC.startSender).toHaveBeenCalled();
    expect(mockDiscovery.beamToPeer).toHaveBeenCalledWith("dev_peer_2", expect.stringMatching(/^pair-/));
    expect(container.textContent).toContain("Waiting for Alice iPad to accept...");
  });

  it("disables connect button for 3 digits and enables for 4 digits", async () => {
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    const pinInput = container.querySelector("input[placeholder='4-digit PIN']") as HTMLInputElement;
    const connectBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Connect"
    ) as HTMLButtonElement;

    expect(connectBtn.disabled).toBe(true);

    // Enter 3 digits
    await act(async () => {
      pinInput.value = "123";
      pinInput.dispatchEvent(new Event("change", { bubbles: true }));
      // React state update helper
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(pinInput, "123");
      pinInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(connectBtn.disabled).toBe(true);

    // Enter 4 digits
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(pinInput, "1234");
      pinInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(connectBtn.disabled).toBe(false);
  });

  it("triggers beam when valid PIN is found", async () => {
    (mockDiscovery.lookupPin as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "dev_found_target",
      name: "Bob Mac",
      avatarEmoji: "🦁",
      os: "macOS",
      formFactor: "laptop",
      peerId: "dev_found_target",
      lastSeen: Date.now(),
    });

    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    const pinInput = container.querySelector("input[placeholder='4-digit PIN']") as HTMLInputElement;
    const connectBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Connect"
    ) as HTMLButtonElement;

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(pinInput, "8888");
      pinInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      connectBtn.click();
    });

    expect(mockDiscovery.lookupPin).toHaveBeenCalledWith("8888");
    expect(mockWebRTC.startSender).toHaveBeenCalled();
    expect(mockDiscovery.beamToPeer).toHaveBeenCalledWith("dev_found_target", expect.stringMatching(/^pair-/));
  });

  it("displays error when PIN is not found online", async () => {
    (mockDiscovery.lookupPin as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    const pinInput = container.querySelector("input[placeholder='4-digit PIN']") as HTMLInputElement;
    const connectBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Connect"
    ) as HTMLButtonElement;

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(pinInput, "0000");
      pinInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      connectBtn.click();
    });

    expect(container.textContent).toContain("No device with that PIN online.");
  });

  it("incoming beam displays modal; Accept starts receiver, Decline clears beam", async () => {
    mockDiscovery.incomingBeam = {
      fromPeer: { name: "Charlie Phone", avatarEmoji: "🐼" },
      roomCode: "pair-incoming-999",
      timestamp: Date.now(),
    };

    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    expect(container.textContent).toContain("Charlie Phone wants to connect");

    // Click Decline
    const declineBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Decline")
    );
    await act(async () => {
      declineBtn?.click();
    });
    expect(mockDiscovery.clearIncomingBeam).toHaveBeenCalled();

    // Now test Accept
    await act(async () => {
      root.render(<NearbyShareCard />);
    });
    const acceptBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Accept")
    );
    await act(async () => {
      acceptBtn?.click();
    });
    expect(mockWebRTC.startReceiver).toHaveBeenCalledWith("pair-incoming-999");
    expect(mockDiscovery.clearIncomingBeam).toHaveBeenCalled();
  });

  it("has 'More ways' details closed by default when online, and open when offline", async () => {
    mockIsOnline = true;
    await act(async () => {
      root.render(<NearbyShareCard key="online" />);
    });

    const detailsEl = Array.from(container.querySelectorAll("details")).find((d) =>
      d.textContent?.includes("More ways")
    ) as HTMLDetailsElement;
    expect(detailsEl).toBeDefined();
    expect(detailsEl.open).toBe(false);

    // Switch to offline
    mockIsOnline = false;
    await act(async () => {
      root.render(<NearbyShareCard key="offline" />);
    });

    const detailsOffline = Array.from(container.querySelectorAll("details")).find((d) =>
      d.textContent?.includes("More ways")
    ) as HTMLDetailsElement;
    expect(detailsOffline).toBeDefined();
    expect(detailsOffline.open).toBe(true);
  });

  it("hides pairing sections and shows neutral message when offline", async () => {
    mockIsOnline = false;
    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    expect(container.textContent).toContain(
      "Pairing needs internet. System share below works without internet."
    );
    expect(container.textContent).not.toContain("My PIN");
    expect(container.textContent).not.toContain("Nearby Devices");
    expect(container.textContent).not.toContain("Or enter their PIN");
  });

  it("connected sender view displays Dropzone and Send button", async () => {
    mockWebRTC.isConnected = true;
    mockWebRTC.role = "sender";

    mockDiscovery.peers = [
      {
        id: "dev_peer_conn",
        name: "Dana Tablet",
        avatarEmoji: "🐱",
        formFactor: "tablet",
        peerId: "p_conn",
        lastSeen: Date.now(),
      },
    ];

    await act(async () => {
      root.render(<NearbyShareCard />);
    });

    const peerButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Dana Tablet")
    );
    await act(async () => {
      peerButton?.click();
    });

    // WebRTC is connected, state transitions to connected
    expect(container.textContent).toContain("Connected to Dana Tablet");
    expect(container.textContent).toContain("Drag & drop files here, or browse");
    const sendBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Send"
    );
    expect(sendBtn).toBeDefined();
  });
});
