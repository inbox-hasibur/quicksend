import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitForDrain, type DrainableChannel } from "../useWebRTC";

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
