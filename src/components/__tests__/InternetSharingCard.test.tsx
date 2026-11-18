import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { InternetSharingCard } from "@/components/InternetSharingCard";
import Home from "@/app/page";

import type { RelayPayloadData } from "@/hooks/useRelayTransfer";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockRelayHook = {
  relayStatus: { available: true, maxFileBytes: 52428800, maxFiles: 5, ttlMinutes: 15 },
  relayState: "idle",
  progress: 0,
  relayCode: null as string | null,
  roomCode: null as string | null,
  qrUrl: null as string | null,
  error: null as string | null,
  relayPayload: null as RelayPayloadData | null,
  isDownloading: false,
  startRelayUpload: vi.fn(),
  cancelRelay: vi.fn(),
  pollRelay: vi.fn(),
  stopPolling: vi.fn(),
  downloadRelay: vi.fn(),
  receiveByOtp: vi.fn(),
  reset: vi.fn(),
};

vi.mock("@/hooks/useRelayTransfer", () => ({
  useRelayTransfer: () => mockRelayHook,
}));

describe("InternetSharingCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockRelayHook.relayState = "idle";
    mockRelayHook.relayCode = null;
    mockRelayHook.roomCode = null;
    mockRelayHook.qrUrl = null;
    mockRelayHook.error = null;
    mockRelayHook.isDownloading = false;
    mockRelayHook.progress = 0;
    vi.clearAllMocks();

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

  it("should render clean idle view with Dropzone, Scan QR, and Enter OTP input", async () => {
    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    expect(container.textContent).toContain("Scan QR");
    expect(container.textContent).toContain("Receive");

    const otpInput = container.querySelector("input[placeholder*='OTP:']");
    expect(otpInput).toBeDefined();

    const scanButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Scan QR")
    );
    expect(scanButton).toBeDefined();
  });

  it("should display Send button when files are selected and trigger startRelayUpload", async () => {
    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      const file = new File(["dummy content"], "doc.txt", { type: "text/plain" });
      await act(async () => {
        Object.defineProperty(fileInput, "files", { value: [file] });
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    const sendBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Send")
    );
    expect(sendBtn).toBeDefined();

    await act(async () => {
      sendBtn?.click();
    });

    expect(mockRelayHook.startRelayUpload).toHaveBeenCalled();
  });

  it("shows QR code and Auto OTP display when relayState is ready", async () => {
    mockRelayHook.relayState = "ready";
    mockRelayHook.relayCode = "K7M2-9QXA";
    mockRelayHook.roomCode = "K7M2";
    mockRelayHook.qrUrl = "https://quicksend.vercel.app/?room=K7M2#rc=K7M29QXA";

    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    expect(container.textContent).toContain("K7M2-9QXA");
    expect(container.textContent).toContain("Auto OTP");
    expect(container.textContent).toContain("Scan QR");
    expect(container.textContent).toContain("Send another file");

    const qrSvg = container.querySelector("svg");
    expect(qrSvg).toBeDefined();
  });

  it("shows receiving indicator when isDownloading is true", async () => {
    mockRelayHook.isDownloading = true;

    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    expect(container.textContent).toContain("Receiving & Decrypting...");
  });

  it("renders page footer with 'Direct by default' and no 'No Server Storage'", async () => {
    await act(async () => {
      root.render(<Home />);
    });

    expect(container.textContent).toContain("Direct by default");
    expect(container.textContent).not.toContain("No Server Storage");
  });
});
