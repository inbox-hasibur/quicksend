import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { CameraSender } from "@/components/camera/CameraSender";
import { CameraReceiver } from "@/components/camera/CameraReceiver";
import { ReceiverCompleteView } from "@/components/camera/ReceiverCompleteView";
import { ReceiverProgressView } from "@/components/camera/ReceiverProgressView";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useQuadScanner", () => ({
  useQuadScanner: () => ({
    containerRef: { current: null },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    isRunning: false,
    error: null,
    detectedLayout: "1x1",
  }),
}));

vi.mock("@/hooks/useHtml5Scanner", () => ({
  useHtml5Scanner: () => ({
    containerRef: { current: null },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getCameras: vi.fn().mockResolvedValue([]),
    isRunning: false,
    isStarting: false,
    error: null,
  }),
}));

describe("Camera Sub-components (CameraParts)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("renders CameraSender with default props and renders dropzone", async () => {
    await act(async () => {
      root.render(React.createElement(CameraSender));
    });

    expect(container.textContent).toContain("Files are compressed and converted");
    const dropzone = container.querySelector('input[type="file"]');
    expect(dropzone).toBeDefined();
  });

  it("renders CameraReceiver with default props and main scanner buttons", async () => {
    await act(async () => {
      root.render(React.createElement(CameraReceiver));
    });

    expect(container.textContent).toContain("Point Camera at QR Stream");
    expect(container.textContent).toContain("Scanner");

    const startBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Start Camera Scanner")
    );
    expect(startBtn).toBeDefined();
  });

  it("renders ReceiverCompleteView with download and action buttons", async () => {
    const mockDownload = vi.fn();
    const mockCopy = vi.fn();
    const mockScanAnother = vi.fn();

    const mockPayload = {
      transferId: "mock-tx-123",
      blob: new Blob(["hello"], { type: "text/plain" }),
      fileName: "test.txt",
      fileSize: 5,
      mimeType: "text/plain",
      text: "hello",
    };

    await act(async () => {
      root.render(
        React.createElement(ReceiverCompleteView, {
          payload: mockPayload,
          copied: false,
          onCopyText: mockCopy,
          onDownload: mockDownload,
          onScanAnother: mockScanAnother,
        })
      );
    });

    expect(container.textContent).toContain("Transfer Complete!");
    expect(container.textContent).toContain("test.txt");

    const copyBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Copy Text")
    );
    expect(copyBtn).toBeDefined();

    await act(async () => {
      copyBtn!.click();
    });
    expect(mockCopy).toHaveBeenCalledTimes(1);
  });

  it("renders ReceiverProgressView with progress bar and missing recovery toggle", async () => {
    const mockToggle = vi.fn();
    const mockCopy = vi.fn();

    const mockProgress = {
      fileName: "image.png",
      fileSize: 1024,
      totalChunks: 10,
      receivedCount: 7,
      percentage: 70,
      missingIndices: [3, 5, 8],
    };

    await act(async () => {
      root.render(
        React.createElement(ReceiverProgressView, {
          scanProgress: mockProgress,
          sessionHash: "abc12345",
          showRecoveryCode: false,
          recoveryCodeCopied: false,
          onToggleRecoveryCode: mockToggle,
          onCopyRecoveryCode: mockCopy,
        })
      );
    });

    expect(container.textContent).toContain("image.png");
    expect(container.textContent).toContain("Received 7 of 10 frames (70%)");

    const toggleBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Missing frames code")
    );
    expect(toggleBtn).toBeDefined();

    await act(async () => {
      toggleBtn!.click();
    });
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
