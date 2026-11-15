import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useQuadScanner, pickLayout, type UseQuadScannerReturn } from "../useQuadScanner";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function QuadScannerConsumer({
  onHook,
}: {
  onHook: (h: UseQuadScannerReturn) => void;
}) {
  const hook = useQuadScanner();
  onHook(hook);
  return React.createElement("div", {
    ref: hook.containerRef,
    "data-testid": "quad-scanner-container",
  });
}

describe("useQuadScanner Hook", () => {
  let container: HTMLDivElement;
  let root: Root;
  let trackStopMock: ReturnType<typeof vi.fn>;
  let mockStream: MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();

    trackStopMock = vi.fn();
    const mockTrack = {
      stop: trackStopMock,
      kind: "video",
    } as unknown as MediaStreamTrack;

    mockStream = {
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });

    // Mock HTMLMediaElement play and pause
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
      Object.defineProperty(this, "videoWidth", { value: 640, writable: true });
      Object.defineProperty(this, "videoHeight", { value: 480, writable: true });
      setTimeout(() => this.dispatchEvent(new Event("playing")), 5);
      return Promise.resolve();
    });
    window.HTMLMediaElement.prototype.pause = vi.fn();

    // Mock BarcodeDetector
    window.BarcodeDetector = class MockBarcodeDetector {
      detect = vi.fn().mockResolvedValue([]);
    };

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

  it("stop twice does not throw and leaves isRunning false", async () => {
    let hookData!: UseQuadScannerReturn;
    await act(async () => {
      root.render(React.createElement(QuadScannerConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      await hookData.start(vi.fn());
    });
    expect(hookData.isRunning).toBe(true);

    await act(async () => {
      await expect(hookData.stop()).resolves.not.toThrow();
    });
    expect(hookData.isRunning).toBe(false);

    await act(async () => {
      await expect(hookData.stop()).resolves.not.toThrow();
    });
    expect(hookData.isRunning).toBe(false);
  });

  it("unmount while running stops tracks once", async () => {
    let hookData!: UseQuadScannerReturn;
    await act(async () => {
      root.render(React.createElement(QuadScannerConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      await hookData.start(vi.fn());
    });
    expect(hookData.isRunning).toBe(true);
    expect(trackStopMock).toHaveBeenCalledTimes(0);

    await act(async () => {
      root.unmount();
    });

    // Unmount cleanup stops tracks once
    expect(trackStopMock).toHaveBeenCalledTimes(1);
  });

  it("container has zero children after stop", async () => {
    let hookData!: UseQuadScannerReturn;
    await act(async () => {
      root.render(React.createElement(QuadScannerConsumer, { onHook: (h) => (hookData = h) }));
    });

    const domContainer = container.querySelector(
      '[data-testid="quad-scanner-container"]'
    ) as HTMLDivElement;
    expect(domContainer).not.toBeNull();
    expect(domContainer.childElementCount).toBe(0);

    await act(async () => {
      await hookData.start(vi.fn());
    });

    // While running, video element was appended
    expect(domContainer.childElementCount).toBe(1);

    await act(async () => {
      await hookData.stop();
    });

    // After stop, zero children remain
    expect(domContainer.childElementCount).toBe(0);
  });

  describe("pickLayout helper", () => {
    it("returns lastGood when missStreak is under 5", () => {
      expect(pickLayout("2x2", 0, 0)).toBe("2x2");
      expect(pickLayout("2x2", 4, 1)).toBe("2x2");
      expect(pickLayout("2x3", 3, 2)).toBe("2x3");
    });

    it("rotates to other candidates when missStreak >= 5", () => {
      // Candidates are ["2x2", "2x3", "1x1"]. For lastGood="2x2", others are ["2x3", "1x1"]
      expect(pickLayout("2x2", 5, 0)).toBe("2x3");
      expect(pickLayout("2x2", 5, 1)).toBe("1x1");
      expect(pickLayout("2x2", 6, 2)).toBe("2x3");

      // For lastGood="2x3", others are ["2x2", "1x1"]
      expect(pickLayout("2x3", 5, 0)).toBe("2x2");
      expect(pickLayout("2x3", 5, 1)).toBe("1x1");
    });

    it("resets back to lastGood immediately when missStreak resets to 0", () => {
      expect(pickLayout("1x1", 0, 5)).toBe("1x1");
    });
  });
});
