import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, useState } from "react";
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
  error: null as string | null,
  relayPayload: null as RelayPayloadData | null,
  isDownloading: false,
  startRelayUpload: vi.fn(),
  cancelRelay: vi.fn(),
  pollRelay: vi.fn(),
  stopPolling: vi.fn(),
  downloadRelay: vi.fn(),
};

vi.mock("@/hooks/useRelayTransfer", () => ({
  useRelayTransfer: () => mockRelayHook,
}));

vi.mock("@/hooks/useWebRTC", () => {
  return {
    useWebRTC: () => {
      const [roomCode, setRoomCode] = useState("834291");
      return {
        role: "sender",
        roomCode,
        isConnected: false,
        progress: {
          status: "idle",
          itemType: "file",
          bytesTransferred: 0,
          totalBytes: 0,
          progressPercentage: 0,
          speedBps: 0,
        },
        brokerNotice: null,
        startSender: vi.fn().mockImplementation((code?: string) => {
          setRoomCode(code || "834291");
          return Promise.resolve({ roomId: `room_${code || "834291"}`, code: code || "834291" });
        }),
        startReceiver: vi.fn().mockImplementation((code: string) => {
          setRoomCode(code);
          return Promise.resolve({ roomId: `room_${code}`, code });
        }),
        sendFiles: vi.fn(),
        sendPayload: vi.fn(),
        acceptIncomingTransfer: vi.fn(),
        rejectIncomingTransfer: vi.fn(),
        cleanup: vi.fn().mockImplementation(() => {
          setRoomCode("");
        }),
        diagnostics: {
          iceState: "new",
          gatheringState: "new",
          signalingState: "stable",
          channelState: "closed",
          candidateCounts: { host: 0, srflx: 0, relay: 0 },
          selectedPair: null,
          lastError: null,
        },
        debugLog: [],
      };
    },
  };
});

describe("InternetSharingCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/turn")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasTurn: true, iceServers: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));
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

  it("should render Send view by default with Dropzone, Pairing Methods, and Live QR/PIN", async () => {
    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    expect(container.textContent).toContain("Send Files or Text");
    expect(container.textContent).toContain("1. Select Files or Text to Send");
    expect(container.textContent).toContain("2. Receiver Connects via QR or PIN");
    expect(container.textContent).toContain("Auto PIN");
    expect(container.textContent).toContain("Mobile No.");
    expect(container.textContent).toContain("Keyword");
    expect(container.textContent).toContain("834-291");
    expect(container.textContent).toContain("Waiting for receiver to connect");

    // QR Code SVG exists
    const qrSvg = container.querySelector("svg");
    expect(qrSvg).toBeDefined();
  });

  it("should switch to Receive view with prominent Scan QR button and PIN input", async () => {
    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    // Find and click the Receive tab in SegmentedControl
    const receiveBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Receive"
    );
    expect(receiveBtn).toBeDefined();

    await act(async () => {
      receiveBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Receive Files");
    expect(container.textContent).toContain("Scan Sender's QR Code");
    expect(container.textContent).toContain("Enter Pairing Code or PIN");
    expect(container.textContent).toContain("Connect to Sender");

    // Input exists for PIN/Code
    const pinInput = container.querySelector("input[placeholder*='123 456']");
    expect(pinInput).toBeDefined();
  });

  it("should auto-submit receiver connection when 6 digits are entered in Auto PIN mode", async () => {
    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    const receiveBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Receive"
    );
    await act(async () => {
      receiveBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const pinInput = container.querySelector("input[placeholder='123 456']") as HTMLInputElement;
    expect(pinInput).toBeDefined();
    expect(pinInput.getAttribute("inputmode")).toBe("numeric");

    await act(async () => {
      // Simulate typing 6 digits
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(pinInput, "654321");
      pinInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Connecting to");
  });

  it("should show mobile input when Mobile No. pairing method is selected", async () => {
    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    const mobileBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Mobile No."
    );
    expect(mobileBtn).toBeDefined();

    await act(async () => {
      mobileBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Sender Mobile Number");
    const phoneInput = container.querySelector("input[placeholder*='01712345678']");
    expect(phoneInput).toBeDefined();
    expect(container.textContent).toContain("Set Number");
  });

  it("should render ConnectionDiagnostics and display TURN warning when hasTurn is false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/turn")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasTurn: false, iceServers: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    // Connection diagnostics details element rendered
    expect(container.textContent).toContain("Connection details");

    // TURN warning notice rendered without amber classes
    expect(container.textContent).toContain("TURN relay not configured — works on same Wi-Fi; 4G mobile data may require TURN.");
    const turnNotice = Array.from(container.querySelectorAll("div")).find((d) =>
      d.textContent?.includes("TURN relay not configured")
    );
    expect(turnNotice).toBeDefined();
    expect(turnNotice?.className).not.toMatch(/amber/);

    vi.unstubAllGlobals();
  });

  it("hides relay button when status.available is false", async () => {
    mockRelayHook.relayStatus = { available: false, maxFileBytes: 52428800, maxFiles: 5, ttlMinutes: 15 };

    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    expect(container.textContent).not.toContain("Send via encrypted cloud relay");
  });

  it("shows consent line when relay button is clicked", async () => {
    mockRelayHook.relayStatus = { available: true, maxFileBytes: 52428800, maxFiles: 5, ttlMinutes: 15 };
    mockRelayHook.relayState = "idle";

    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    // Simulate file drop or text input in Dropzone
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      const file = new File(["dummy content"], "doc.txt", { type: "text/plain" });
      await act(async () => {
        Object.defineProperty(fileInput, "files", { value: [file] });
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    const relayBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Send via encrypted cloud relay")
    );
    expect(relayBtn).toBeDefined();

    await act(async () => {
      relayBtn?.click();
    });

    expect(container.textContent).toContain(
      "This uploads an encrypted copy to temporary cloud storage. It is deleted after download or within 24 hours."
    );
    expect(container.textContent).toContain("Continue");
  });

  it("shows relay code in large text when relayState is ready", async () => {
    mockRelayHook.relayStatus = { available: true, maxFileBytes: 52428800, maxFiles: 5, ttlMinutes: 15 };
    mockRelayHook.relayState = "ready";
    mockRelayHook.relayCode = "K7M2-9QXA";

    await act(async () => {
      root.render(<InternetSharingCard />);
    });

    // Simulate file selection so relay container is visible
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      const file = new File(["dummy content"], "doc.txt", { type: "text/plain" });
      await act(async () => {
        Object.defineProperty(fileInput, "files", { value: [file] });
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    expect(container.textContent).toContain("K7M2-9QXA");
    expect(container.textContent).toContain("Receiver enters PIN 834-291, then this relay code.");
    expect(container.textContent).toContain("Copy Code");
  });

  it("renders page footer with 'Direct by default' and no 'No Server Storage'", async () => {
    await act(async () => {
      root.render(<Home />);
    });

    expect(container.textContent).toContain("Direct by default");
    expect(container.textContent).not.toContain("No Server Storage");
  });
});
