import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { waitForDrain, useWebRTC, type DrainableChannel } from "../useWebRTC";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("waitForDrain", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when channel is null or undefined", async () => {
    await expect(waitForDrain(null, 1024)).resolves.toBeUndefined();
    await expect(waitForDrain(undefined, 1024)).resolves.toBeUndefined();
  });

  it("resolves immediately when channel bufferedAmount is <= threshold", async () => {
    const mockChannel: DrainableChannel = {
      bufferedAmount: 500,
      bufferedAmountLowThreshold: 0,
    };

    await expect(waitForDrain(mockChannel, 1000)).resolves.toBeUndefined();
    await expect(waitForDrain(mockChannel, 500)).resolves.toBeUndefined();
  });

  it("sets bufferedAmountLowThreshold and resolves on addEventListener bufferedamountlow event", async () => {
    let capturedListener: (() => void) | null = null;
    const mockChannel: DrainableChannel = {
      bufferedAmount: 2000,
      bufferedAmountLowThreshold: 0,
      addEventListener: vi.fn((event: string, listener: () => void) => {
        if (event === "bufferedamountlow") {
          capturedListener = listener;
        }
      }),
      removeEventListener: vi.fn(),
    };

    let resolved = false;
    const promise = waitForDrain(mockChannel, 1000).then(() => {
      resolved = true;
    });

    expect(mockChannel.bufferedAmountLowThreshold).toBe(1000);
    expect(mockChannel.addEventListener).toHaveBeenCalledWith(
      "bufferedamountlow",
      expect.any(Function),
      { once: true }
    );
    expect(resolved).toBe(false);

    // Simulate bufferedamountlow event firing
    expect(capturedListener).toBeTypeOf("function");
    capturedListener!();

    await promise;
    expect(resolved).toBe(true);
    expect(mockChannel.removeEventListener).toHaveBeenCalledWith(
      "bufferedamountlow",
      expect.any(Function)
    );
  });

  it("resolves on onbufferedamountlow callback when addEventListener is not available", async () => {
    const mockChannel: DrainableChannel = {
      bufferedAmount: 2000,
      bufferedAmountLowThreshold: 0,
      onbufferedamountlow: null,
    };

    let resolved = false;
    const promise = waitForDrain(mockChannel, 1000).then(() => {
      resolved = true;
    });

    expect(mockChannel.bufferedAmountLowThreshold).toBe(1000);
    expect(mockChannel.onbufferedamountlow).toBeTypeOf("function");
    expect(resolved).toBe(false);

    // Trigger onbufferedamountlow callback
    mockChannel.onbufferedamountlow!(new Event("bufferedamountlow"));

    await promise;
    expect(resolved).toBe(true);
    expect(mockChannel.onbufferedamountlow).toBeNull();
  });

  it("resolves on safety timeout when event is never dispatched", async () => {
    vi.useFakeTimers();

    const mockChannel: DrainableChannel = {
      bufferedAmount: 5000,
      bufferedAmountLowThreshold: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    let resolved = false;
    const promise = waitForDrain(mockChannel, 1000, 5000).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    // Advance 4999ms - should still be pending
    vi.advanceTimersByTime(4999);
    expect(resolved).toBe(false);

    // Advance to 5000ms safety timeout
    vi.advanceTimersByTime(1);
    await vi.runAllTimersAsync();
    await promise;

    expect(resolved).toBe(true);
    expect(mockChannel.removeEventListener).toHaveBeenCalledWith(
      "bufferedamountlow",
      expect.any(Function)
    );
  });
});

describe("useWebRTC hook", () => {
  let container: HTMLDivElement;
  let root: Root;
  let currentHook: ReturnType<typeof useWebRTC>;

  function HookTester() {
    currentHook = useWebRTC("internet");
    return null;
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    if (typeof globalThis.RTCPeerConnection === "undefined") {
      class MockRTCPeerConnection {
        iceConnectionState = "new";
        iceGatheringState = "new";
        signalingState = "stable";
        connectionState = "new";
        restartIce = vi.fn();
        createDataChannel = vi.fn().mockReturnValue({
          binaryType: "arraybuffer",
          readyState: "connecting",
          send: vi.fn(),
          close: vi.fn(),
          bufferedAmount: 0,
          bufferedAmountLowThreshold: 0,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        });
        createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "mock-sdp" });
        setLocalDescription = vi.fn().mockResolvedValue(undefined);
        setRemoteDescription = vi.fn().mockResolvedValue(undefined);
        createAnswer = vi.fn().mockResolvedValue({ type: "answer", sdp: "mock-sdp" });
        addIceCandidate = vi.fn().mockResolvedValue(undefined);
        close = vi.fn();
      }
      // @ts-expect-error Assigning mock to global
      globalThis.RTCPeerConnection = MockRTCPeerConnection;
    }
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not prematurely fail with a 10s ICE timeout when waiting for connection", async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(React.createElement(HookTester));
    });

    expect(currentHook.progress.status).toBe("idle");

    await act(async () => {
      currentHook.startSender();
    });

    expect(currentHook.progress.status).toBe("connecting");

    // Advance by 12 seconds (past old 10-second timeout threshold)
    await act(async () => {
      vi.advanceTimersByTime(12000);
    });

    // It must remain connecting, NOT transition to error
    expect(currentHook.progress.status).toBe("connecting");

    // Advance further to 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(18000);
    });

    expect(currentHook.progress.status).toBe("connecting");

    // Clean up cleanly
    await act(async () => {
      currentHook.cleanup();
    });

    expect(currentHook.progress.status).toBe("idle");
  });
});
