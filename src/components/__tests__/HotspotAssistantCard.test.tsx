import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { HotspotAssistantCard } from "@/components/HotspotAssistantCard";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUseOfflineHotspotRTC = vi.fn();

vi.mock("@/hooks/useOfflineHotspotRTC", () => ({
  useOfflineHotspotRTC: () => mockUseOfflineHotspotRTC(),
}));

describe("HotspotAssistantCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  let mockCreateOfflineOffer: ReturnType<typeof vi.fn>;
  let mockAcceptOfflineOffer: ReturnType<typeof vi.fn>;
  let mockCompleteOfflineAnswer: ReturnType<typeof vi.fn>;
  let mockSendFiles: ReturnType<typeof vi.fn>;
  let mockSendText: ReturnType<typeof vi.fn>;
  let mockCleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreateOfflineOffer = vi.fn().mockResolvedValue("QS3:o|ufrag|pwd|hex|actpass|0|5000|");
    mockAcceptOfflineOffer = vi.fn().mockResolvedValue("QS3:a|ufrag|pwd|hex|active|0|5000|");
    mockCompleteOfflineAnswer = vi.fn().mockResolvedValue(undefined);
    mockSendFiles = vi.fn().mockResolvedValue(undefined);
    mockSendText = vi.fn().mockResolvedValue(undefined);
    mockCleanup = vi.fn();

    mockUseOfflineHotspotRTC.mockReturnValue({
      isConnected: false,
      progress: { status: "idle" },
      pendingHeader: null,
      localQrPayload: null,
      error: null,
      createOfflineOffer: mockCreateOfflineOffer,
      acceptOfflineOffer: mockAcceptOfflineOffer,
      completeOfflineAnswer: mockCompleteOfflineAnswer,
      sendFiles: mockSendFiles,
      sendText: mockSendText,
      acceptIncomingTransfer: vi.fn(),
      rejectIncomingTransfer: vi.fn(),
      cleanup: mockCleanup,
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

  it("should render unified Hotspot layout with zero radar, fake SSID forms, or avatar controls", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    // Unified Header
    expect(container.textContent).toContain("Wi-Fi Hotspot");
    expect(container.textContent).toContain(
      "Direct transfer over mobile hotspot — works with or without internet"
    );
    expect(container.textContent).toContain("Send");
    expect(container.textContent).toContain("Receive");

    // 1-line helper bar
    expect(container.textContent).toContain(
      "Turn on Mobile Hotspot on either device and connect the other via Wi-Fi"
    );
    expect(container.textContent).toContain("Hotspot Settings");
    expect(container.textContent).toContain("Wi-Fi Settings");

    // Strictly ensure no online radar, fake credentials, or avatar editing exist
    expect(container.textContent).not.toContain("Devices on this Hotspot");
    expect(container.textContent).not.toContain("Scanning hotspot...");
    expect(container.textContent).not.toContain("QuickSend-Hotspot");
    expect(container.textContent).not.toContain("share1234");
    expect(container.textContent).not.toContain("Your Device PIN");
    expect(container.textContent).not.toContain("Edit Device Name");
  });

  it("should have Send button disabled until payload selected, then trigger createOfflineOffer on click", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    // Primary Send button in Send view
    const sendBtn = Array.from(container.querySelectorAll("button"))
      .filter((b) => b.textContent?.trim() === "Send")
      .pop();
    expect(sendBtn).toBeDefined();
    expect(sendBtn?.hasAttribute("disabled")).toBe(true);

    // Select file in Dropzone
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    const file = new File(["test content"], "photo.jpg", { type: "image/jpeg" });
    await act(async () => {
      Object.defineProperty(fileInput, "files", { value: [file] });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Button should now be enabled
    expect(sendBtn?.hasAttribute("disabled")).toBe(false);

    // Click Send
    await act(async () => {
      sendBtn?.click();
    });

    expect(mockCreateOfflineOffer).toHaveBeenCalled();
  });

  it("should render clean Receive view with primary Scan Sender's QR button", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    const receiveTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Receive"
    );
    expect(receiveTabBtn).toBeDefined();

    await act(async () => {
      receiveTabBtn?.click();
    });

    expect(container.textContent).toContain("Ready to receive over Hotspot");
    expect(container.textContent).toContain(
      "Scan the sender's QR code to connect and receive files directly."
    );

    const scanBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Scan Sender's QR")
    );
    expect(scanBtn).toBeDefined();

    // Clicking scan opens handshake modal in receiver mode
    await act(async () => {
      scanBtn?.click();
    });

    // Handshake modal should open with Scan Sender's QR title
    expect(container.textContent).toContain("Connect via Hotspot QR");
  });

  it("should cleanup previous session when switching tabs or closing", async () => {
    await act(async () => {
      root.render(<HotspotAssistantCard />);
    });

    const receiveTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Receive"
    );

    await act(async () => {
      receiveTabBtn?.click();
    });

    expect(mockCleanup).toHaveBeenCalled();
  });
});
