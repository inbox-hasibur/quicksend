import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { HotspotAssistantCard } from "@/components/HotspotAssistantCard";
import type { NearbyPeer } from "@/hooks/useLocalDiscovery";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUseBrowserCapabilities = vi.fn();
const mockUseLocalDiscovery = vi.fn();
const mockUseWebRTC = vi.fn();
const mockUseOfflineHotspotRTC = vi.fn();

vi.mock("@/hooks/useNetworkStatus", () => ({
  useBrowserCapabilities: () => mockUseBrowserCapabilities(),
}));

vi.mock("@/hooks/useLocalDiscovery", () => ({
  useLocalDiscovery: (isOnline: boolean) => mockUseLocalDiscovery(isOnline),
}));

vi.mock("@/hooks/useWebRTC", () => ({
  useWebRTC: (mode: string) => mockUseWebRTC(mode),
}));

vi.mock("@/hooks/useOfflineHotspotRTC", () => ({
  useOfflineHotspotRTC: () => mockUseOfflineHotspotRTC(),
}));

describe("HotspotAssistantCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  let mockStartSender: ReturnType<typeof vi.fn>;
  let mockBeamToPeer: ReturnType<typeof vi.fn>;
  let mockUpdateName: ReturnType<typeof vi.fn>;
  let mockCreateOfflineOffer: ReturnType<typeof vi.fn>;
  let mockPeers: NearbyPeer[];

  beforeEach(() => {
    mockPeers = [];
    mockStartSender = vi.fn().mockResolvedValue(undefined);
    mockBeamToPeer = vi.fn().mockResolvedValue(undefined);
    mockUpdateName = vi.fn();
    mockCreateOfflineOffer = vi.fn().mockResolvedValue("OPTSDP:mock-offer");

    mockUseBrowserCapabilities.mockReturnValue({
      isOnline: true,
      hasWebShare: false,
      hasBluetooth: false,
    });

    mockUseLocalDiscovery.mockImplementation(() => ({
      profile: {
        id: "my-id",
        name: "My Laptop",
        codename: "Crimson Hawk",
        avatarEmoji: "🦅",
        avatarColor: "#0EA5E9",
        formFactor: "desktop",
        os: "Windows",
        browser: "Chrome",
      },
      peers: mockPeers,
      incomingBeam: null,
      beamToPeer: mockBeamToPeer,
      clearIncomingBeam: vi.fn().mockResolvedValue(undefined),
      cycleAvatar: vi.fn(),
      updateName: mockUpdateName,
    }));

    mockUseWebRTC.mockReturnValue({
      role: "sender",
      isConnected: false,
      progress: { status: "idle" },
      startSender: mockStartSender,
      startReceiver: vi.fn().mockResolvedValue(undefined),
      sendFiles: vi.fn().mockResolvedValue(undefined),
      sendPayload: vi.fn().mockResolvedValue(undefined),
      acceptIncomingTransfer: vi.fn(),
      rejectIncomingTransfer: vi.fn(),
      cleanup: vi.fn(),
      diagnostics: { iceState: "new", candidateCounts: { host: 0, srflx: 0, relay: 0 } },
    });

    mockUseOfflineHotspotRTC.mockReturnValue({
      isConnected: false,
      progress: { status: "idle" },
      localQrPayload: null,
      createOfflineOffer: mockCreateOfflineOffer,
      acceptOfflineOffer: vi.fn().mockResolvedValue("OPTSDP:mock-answer"),
      completeOfflineAnswer: vi.fn().mockResolvedValue(undefined),
      sendFiles: vi.fn().mockResolvedValue(undefined),
      sendText: vi.fn().mockResolvedValue(undefined),
      acceptIncomingTransfer: vi.fn(),
      rejectIncomingTransfer: vi.fn(),
      cleanup: vi.fn(),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("should render clean step-by-step layout without fake SSID/password form or legacy PIN sections", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    expect(container.textContent).toContain("Wi-Fi Hotspot");
    expect(container.textContent).toContain("Send");
    expect(container.textContent).toContain("Receive");
    expect(container.textContent).toContain("Connect both devices to the same Mobile Hotspot");
    expect(container.textContent).toContain("Hotspot Settings");
    expect(container.textContent).toContain("Wi-Fi Settings");

    // Strictly ensure fake SSID/password form and old PIN sections are removed
    expect(container.textContent).not.toContain("QuickSend-Hotspot");
    expect(container.textContent).not.toContain("share1234");
    expect(container.textContent).not.toContain("Your Device PIN");
    expect(container.textContent).not.toContain("Connect to Another Device PIN");
    expect(container.textContent).not.toContain("Can't see your device?");
  });

  it("should auto-beam immediately when exactly 1 peer is discovered online and payload is selected", async () => {
    mockPeers = [
      {
        id: "peer-1",
        peerId: "peer-1",
        name: "Pixel 8",
        codename: "Swift Dolphin",
        avatarEmoji: "🐬",
        avatarColor: "#06B6D4",
        formFactor: "mobile",
        lastSeen: Date.now(),
      },
    ];

    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    // Select a file via dropzone input
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    const file = new File(["test data"], "report.pdf", { type: "application/pdf" });
    await act(async () => {
      Object.defineProperty(fileInput, "files", { value: [file] });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Click "Send" action button (not the SegmentedControl tab button)
    const sendBtn = Array.from(container.querySelectorAll("button"))
      .filter((b) => b.textContent?.trim() === "Send")
      .pop();
    expect(sendBtn).toBeDefined();

    await act(async () => {
      sendBtn?.click();
    });

    // Auto-beam should trigger immediately for single peer without advancing to Step 2
    expect(mockStartSender).toHaveBeenCalledWith(expect.any(String));
    expect(mockBeamToPeer).toHaveBeenCalledWith("peer-1", expect.any(String));
    expect(container.textContent).not.toContain("Devices on this Hotspot");
  });

  it("should show Step 2 radar picker when multiple peers are connected online", async () => {
    mockPeers = [
      {
        id: "peer-1",
        peerId: "peer-1",
        name: "Pixel 8",
        codename: "Swift Dolphin",
        avatarEmoji: "🐬",
        avatarColor: "#06B6D4",
        formFactor: "mobile",
        lastSeen: Date.now(),
      },
      {
        id: "peer-2",
        peerId: "peer-2",
        name: "Galaxy S24",
        codename: "Golden Lion",
        avatarEmoji: "🦁",
        avatarColor: "#F59E0B",
        formFactor: "mobile",
        lastSeen: Date.now(),
      },
    ];

    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    // Select a file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test data"], "report.pdf", { type: "application/pdf" });
    await act(async () => {
      Object.defineProperty(fileInput, "files", { value: [file] });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Click "Send" action button
    const sendBtn = Array.from(container.querySelectorAll("button"))
      .filter((b) => b.textContent?.trim() === "Send")
      .pop();
    await act(async () => {
      sendBtn?.click();
    });

    // Advances to Step 2 with RadarPanel showing multiple peers
    expect(container.textContent).toContain("Devices on this Hotspot (2)");
    expect(container.textContent).toContain("Change files (1 file)");

    // Clicking "Change files" returns to Step 1
    const changeFilesBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Change files")
    );
    await act(async () => {
      changeFilesBtn?.click();
    });

    expect(container.textContent).not.toContain("Devices on this Hotspot (2)");
  });

  it("should render waiting radar and offline fallback on online Receive tab", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    const receiveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Receive"
    );
    expect(receiveBtn).toBeDefined();

    await act(async () => {
      receiveBtn?.click();
    });

    expect(container.textContent).toContain("Waiting on Hotspot...");
    expect(container.textContent).toContain("Ready to receive on Hotspot");
    expect(container.textContent).toContain("Pair via Offline QR");
  });

  it("should adapt to 100% offline QR pairing when isOnline is false", async () => {
    mockUseBrowserCapabilities.mockReturnValue({
      isOnline: false,
      hasWebShare: false,
      hasBluetooth: false,
    });

    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    // Offline indicator pill is rendered
    expect(container.textContent).toContain(
      "Offline Hotspot Mode • Direct QR Pair (No Internet Needed)"
    );

    // Online radar is NOT rendered
    expect(container.textContent).not.toContain("Scanning hotspot...");

    // Send button specifically states Send via Offline QR
    const offlineSendBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Send via Offline QR")
    );
    expect(offlineSendBtn).toBeDefined();

    // Select file and click Send via Offline QR
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test data"], "report.pdf", { type: "application/pdf" });
    await act(async () => {
      Object.defineProperty(fileInput, "files", { value: [file] });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      offlineSendBtn?.click();
    });

    expect(mockCreateOfflineOffer).toHaveBeenCalled();

    // Switch to Receive tab while offline
    const receiveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Receive"
    );
    await act(async () => {
      receiveBtn?.click();
    });

    expect(container.textContent).toContain("Receive without Internet");
    expect(container.textContent).toContain("Scan Sender's QR to Receive");
  });

  it("should allow editing device profile name", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    const editBtn = container.querySelector('button[title="Edit Device Name"]') as HTMLButtonElement;
    expect(editBtn).toBeDefined();

    await act(async () => {
      editBtn.click();
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeDefined();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "Work MacBook");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    // Click check button to save name
    const saveBtn = container.querySelector('button[title="Save Name"]') as HTMLButtonElement;
    if (saveBtn) {
      await act(async () => {
        saveBtn.click();
      });
    }

    expect(mockUpdateName).toHaveBeenCalledWith("Work MacBook");
  });
});
