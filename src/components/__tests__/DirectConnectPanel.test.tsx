import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { DirectConnectPanel } from "@/components/DirectConnectPanel";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DirectConnectPanel Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders with formatted PIN, action buttons, and labels", async () => {
    const onShowQr = vi.fn();
    const onScanQr = vi.fn();
    const onConnect = vi.fn();
    const onPeerPinChange = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(DirectConnectPanel, {
          myPin: "654321",
          onShowQr,
          peerPinValue: "",
          onPeerPinChange,
          onConnect,
          onScanQr,
          myPinLabel: "My Device PIN",
          peerPinLabel: "Connect to Host PIN",
        })
      );
    });

    expect(container.textContent).toContain("My Device PIN");
    expect(container.textContent).toContain("Connect to Host PIN");
    expect(container.textContent).toContain("654-321"); // formatted PIN with hyphen
    expect(container.textContent).toContain("Show QR");
    expect(container.textContent).toContain("Scan QR Code with Camera");

    // Click Show QR button
    const showQrBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Show QR")
    );
    expect(showQrBtn).toBeDefined();

    await act(async () => {
      showQrBtn!.click();
    });
    expect(onShowQr).toHaveBeenCalledTimes(1);

    // Click Scan QR button
    const scanQrBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Scan QR Code with Camera")
    );
    expect(scanQrBtn).toBeDefined();

    await act(async () => {
      scanQrBtn!.click();
    });
    expect(onScanQr).toHaveBeenCalledTimes(1);
  });

  it("normalizes typed PIN with dashes and spaces before invoking onConnect", async () => {
    const onConnect = vi.fn();
    const onPeerPinChange = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(DirectConnectPanel, {
          myPin: "111222",
          onShowQr: vi.fn(),
          peerPinValue: "456-789", // Contains a dash
          onPeerPinChange,
          onConnect,
          onScanQr: vi.fn(),
        })
      );
    });

    const connectBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Connect")
    );
    expect(connectBtn).toBeDefined();

    await act(async () => {
      connectBtn!.click();
    });

    // Must be normalized to clean 6 digits without dash
    expect(onConnect).toHaveBeenCalledWith("456789");
  });

  it("normalizes typed PIN with spaces on Enter keydown", async () => {
    const onConnect = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(DirectConnectPanel, {
          myPin: "111222",
          onShowQr: vi.fn(),
          peerPinValue: " 987 654 ",
          onPeerPinChange: vi.fn(),
          onConnect,
          onScanQr: vi.fn(),
        })
      );
    });

    const input = container.querySelector("input");
    expect(input).toBeDefined();

    await act(async () => {
      input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onConnect).toHaveBeenCalledWith("987654");
  });

  it("copies device PIN to clipboard and handles isConnecting state", async () => {
    await act(async () => {
      root.render(
        React.createElement(DirectConnectPanel, {
          myPin: "555666",
          onShowQr: vi.fn(),
          peerPinValue: "123456",
          onPeerPinChange: vi.fn(),
          onConnect: vi.fn(),
          onScanQr: vi.fn(),
          isConnecting: true,
          error: "Failed to establish WebRTC link.",
        })
      );
    });

    expect(container.textContent).toContain("Failed to establish WebRTC link.");

    // Connect button should be disabled while connecting
    const connectBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Connect") || btn.querySelector(".animate-spin")
    );
    expect(connectBtn?.hasAttribute("disabled")).toBe(true);

    // Copy PIN button
    const copyBtn = container.querySelector('button[aria-label="Copy PIN"]');
    expect(copyBtn).toBeDefined();

    await act(async () => {
      copyBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("555666");
  });
});
