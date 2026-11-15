import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useHtml5Scanner, type UseHtml5ScannerReturn } from "../useHtml5Scanner";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { mockStart, mockStop, mockClear, mockGetCameras } = vi.hoisted(() => ({
  mockStart: vi.fn(),
  mockStop: vi.fn().mockImplementation(async () => undefined),
  mockClear: vi.fn().mockImplementation(async () => undefined),
  mockGetCameras: vi.fn().mockImplementation(async () => []),
}));

vi.mock("html5-qrcode", () => {
  return {
    Html5Qrcode: class MockHtml5Qrcode {
      elementId: string;
      constructor(elementId: string) {
        this.elementId = elementId;
      }
      start = (...args: unknown[]) => mockStart.call(this, ...args);
      stop = mockStop;
      clear = mockClear;
      static getCameras = mockGetCameras;
    },
  };
});

function ScannerConsumer({
  onHook,
}: {
  onHook: (h: UseHtml5ScannerReturn) => void;
}) {
  const hook = useHtml5Scanner();
  onHook(hook);
  return React.createElement("div", {
    ref: hook.containerRef,
    "data-testid": "scanner-container",
  });
}

describe("useHtml5Scanner Hook", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure navigator.mediaDevices exists in test environment
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: vi.fn() },
        configurable: true,
      });
    }

    mockStart.mockImplementation(async function (this: { elementId?: string }) {
      if (this.elementId) {
        const el = document.getElementById(this.elementId);
        if (el) {
          const video = document.createElement("video");
          Object.defineProperty(video, "videoWidth", { value: 1280, writable: true });
          el.appendChild(video);
          setTimeout(() => video.dispatchEvent(new Event("playing")), 10);
        }
      }
      return undefined;
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
  });

  it("should safely allow calling stop() twice without throwing", async () => {
    let hookData!: UseHtml5ScannerReturn;
    await act(async () => {
      root.render(React.createElement(ScannerConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      await hookData.start(vi.fn());
    });

    expect(hookData.isRunning).toBe(true);

    // Call stop() once
    await act(async () => {
      await hookData.stop();
    });
    expect(hookData.isRunning).toBe(false);

    // Call stop() twice
    await expect(
      act(async () => {
        await hookData.stop();
      })
    ).resolves.not.toThrow();

    expect(hookData.isRunning).toBe(false);
  });

  it("should not throw when the child div was already removed from the DOM before stop()", async () => {
    let hookData!: UseHtml5ScannerReturn;
    await act(async () => {
      root.render(React.createElement(ScannerConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      await hookData.start(vi.fn());
    });

    // Artificially remove child from container before stop is called
    if (hookData.containerRef.current) {
      hookData.containerRef.current.innerHTML = "";
    }

    await expect(
      act(async () => {
        await hookData.stop();
      })
    ).resolves.not.toThrow();

    expect(hookData.isRunning).toBe(false);
  });

  it("should automatically call stop once when component unmounts while running", async () => {
    let hookData!: UseHtml5ScannerReturn;
    await act(async () => {
      root.render(React.createElement(ScannerConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      await hookData.start(vi.fn());
    });

    expect(hookData.isRunning).toBe(true);
    expect(mockStop).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("should ensure the container has zero child nodes after stop()", async () => {
    let hookData!: UseHtml5ScannerReturn;
    await act(async () => {
      root.render(React.createElement(ScannerConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      await hookData.start(vi.fn());
    });

    // While running, container has exactly the isolated scanner child
    expect(hookData.containerRef.current?.childNodes.length).toBe(1);

    await act(async () => {
      await hookData.stop();
    });

    // After stop(), container has zero child nodes
    expect(hookData.containerRef.current?.childNodes.length).toBe(0);
  });

  it("should never give the container display none when start() is called", async () => {
    let hookData!: UseHtml5ScannerReturn;
    await act(async () => {
      root.render(React.createElement(ScannerConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      await hookData.start(vi.fn());
    });

    const el = hookData.containerRef.current;
    expect(el).not.toBeNull();
    if (el) {
      expect(el.style.display).not.toBe("none");
      expect(el.classList.contains("hidden")).toBe(false);
      expect(el.classList.contains("invisible")).toBe(false);
    }
  });
});
