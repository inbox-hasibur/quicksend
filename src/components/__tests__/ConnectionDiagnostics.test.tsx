import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { ConnectionDiagnostics } from "@/components/ConnectionDiagnostics";
import type { WebRTCDiagnostics, DebugLogEntry } from "@/hooks/useWebRTC";
import type { DiscoveryStatus } from "@/hooks/useLocalDiscovery";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ConnectionDiagnostics Component", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalFetch = global.fetch;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/health") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, storage: "memory" }),
        });
      }
      return Promise.reject(new Error("unexpected url"));
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const mockDiagnostics: WebRTCDiagnostics = {
    iceState: "connected",
    gatheringState: "complete",
    signalingState: "stable",
    channelState: "open",
    candidateCounts: { host: 2, srflx: 1, relay: 0 },
    selectedPair: { local: "host", remote: "host" },
    lastError: null,
  };

  const mockDebugLog: DebugLogEntry[] = [
    { t: 0, msg: "Sender started" },
    { t: 150, msg: "Offer created" },
    { t: 320, msg: "ICE state: connected" },
  ];

  const mockDiscoveryStatus: DiscoveryStatus = {
    lastPollOk: true,
    lastPollAt: 123456789,
    lastError: null,
    peerCount: 2,
    groupLabel: "192.168.x.x",
    ipFamily: "v4",
  };

  it("renders closed by default", async () => {
    await act(async () => {
      root.render(
        <ConnectionDiagnostics
          diagnostics={mockDiagnostics}
          debugLog={mockDebugLog}
          discoveryStatus={mockDiscoveryStatus}
        />
      );
    });

    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("Connection details");
  });

  it("shows fields when opened and fetches /api/health", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/health") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, storage: "memory" }),
        });
      }
      return Promise.reject(new Error("unexpected url"));
    });
    global.fetch = mockFetch;

    await act(async () => {
      root.render(
        <ConnectionDiagnostics
          diagnostics={mockDiagnostics}
          debugLog={mockDebugLog}
          discoveryStatus={mockDiscoveryStatus}
        />
      );
    });

    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/health");
    expect(details.textContent).toContain("Server storage:");
    expect(details.textContent).toContain("memory");
    expect(details.textContent).toContain(
      "Warning: memory storage is not shared between server instances"
    );
    expect(details.textContent).toContain("Network group:");
    expect(details.textContent).toContain("192.168.x.x (v4)");
    expect(details.textContent).toContain("Radar:");
    expect(details.textContent).toContain("OK (2 peers)");
    expect(details.textContent).toContain("ICE state:");
    expect(details.textContent).toContain("connected");
    expect(details.textContent).toContain("Gathering:");
    expect(details.textContent).toContain("complete");
    expect(details.textContent).toContain("Signaling:");
    expect(details.textContent).toContain("stable");
    expect(details.textContent).toContain("Channel:");
    expect(details.textContent).toContain("open");
    expect(details.textContent).toContain("Candidates:");
    expect(details.textContent).toContain("host 2 | srflx 1 | relay 0");
    expect(details.textContent).toContain("Selected pair:");
    expect(details.textContent).toContain("local host, remote host");
    expect(details.textContent).toContain("+150ms: Offer created");
  });

  it("calls navigator.clipboard.writeText with text containing 'ICE state' when Copy report clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    await act(async () => {
      root.render(
        <ConnectionDiagnostics
          diagnostics={mockDiagnostics}
          debugLog={mockDebugLog}
          discoveryStatus={mockDiscoveryStatus}
        />
      );
    });

    const details = container.querySelector("details") as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Copy report")
    );
    expect(button).toBeDefined();

    await act(async () => {
      button?.click();
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("ICE state");
    expect(copiedText).toContain("connected");
    expect(copiedText).toContain("192.168.x.x");
    expect(button?.textContent).toBe("Copied");
  });
});
