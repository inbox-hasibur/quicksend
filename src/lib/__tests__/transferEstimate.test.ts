import { describe, it, expect } from "vitest";
import {
  estimateSeconds,
  formatDuration,
  estimateCameraFrames,
  DEFAULT_CHANNEL_SPEEDS_BYTES_PER_SEC,
} from "@/lib/transferEstimate";

describe("transferEstimate", () => {
  it("should calculate correct default estimation with 1s overhead for each network channel", () => {
    // 1. Internet (1.5 MB/s)
    const internetSpeed = DEFAULT_CHANNEL_SPEEDS_BYTES_PER_SEC.internet;
    const internetBytes = internetSpeed * 2;
    const internetEst = estimateSeconds("internet", internetBytes);
    expect(internetEst.seconds).toBeCloseTo(3, 1); // 2s transfer + 1s overhead
    expect(internetEst.approximate).toBe(true);

    // 2. Same-network (15 MB/s)
    const sameNetSpeed = DEFAULT_CHANNEL_SPEEDS_BYTES_PER_SEC["same-network"];
    const sameNetBytes = sameNetSpeed;
    const sameNetEst = estimateSeconds("same-network", sameNetBytes);
    expect(sameNetEst.seconds).toBeCloseTo(2, 1); // 1s transfer + 1s overhead
    expect(sameNetEst.approximate).toBe(true);

    // 3. Hotspot (6 MB/s)
    const hotspotSpeed = DEFAULT_CHANNEL_SPEEDS_BYTES_PER_SEC.hotspot;
    const hotspotBytes = hotspotSpeed * 3;
    const hotspotEst = estimateSeconds("hotspot", hotspotBytes);
    expect(hotspotEst.seconds).toBeCloseTo(4, 1); // 3s transfer + 1s overhead
    expect(hotspotEst.approximate).toBe(true);

    // 4. Bluetooth (0.8 MB/s)
    const btSpeed = DEFAULT_CHANNEL_SPEEDS_BYTES_PER_SEC.bluetooth;
    const btBytes = btSpeed;
    const btEst = estimateSeconds("bluetooth", btBytes);
    expect(btEst.seconds).toBeCloseTo(2, 1); // 1s transfer + 1s overhead
    expect(btEst.approximate).toBe(true);

    // 5. Cable (40 MB/s)
    const cableSpeed = DEFAULT_CHANNEL_SPEEDS_BYTES_PER_SEC.cable;
    const cableBytes = cableSpeed * 2;
    const cableEst = estimateSeconds("cable", cableBytes);
    expect(cableEst.seconds).toBeCloseTo(3, 1); // 2s transfer + 1s overhead
    expect(cableEst.approximate).toBe(true);
  });

  it("should allow measured speed to override default and set approximate to false", () => {
    const totalBytes = 10_000_000;
    const measuredBps = 2_500_000; // 4 seconds exactly
    const est = estimateSeconds("internet", totalBytes, {
      measuredBytesPerSec: measuredBps,
    });
    expect(est.seconds).toBe(4);
    expect(est.approximate).toBe(false);
  });

  it("should calculate camera transfer time using frames count without handshake overhead", () => {
    const est = estimateSeconds("camera", 5000, {
      frames: 20,
      frameIntervalMs: 250,
    });
    // 20 frames * 250ms = 5000ms = 5 seconds
    expect(est.seconds).toBe(5);
    expect(est.approximate).toBe(true);
  });

  it("should calculate camera transfer time with framesPerTick in 2x2 grid mode", () => {
    // 21 frames, 4 frames per tick, 200ms per tick
    // ceil(21 / 4) = 6 ticks * 200ms = 1200ms = 1.2 seconds
    const est = estimateSeconds("camera", 5000, {
      frames: 21,
      frameIntervalMs: 200,
      framesPerTick: 4,
    });
    expect(est.seconds).toBe(1.2);
    expect(est.approximate).toBe(true);
  });

  it("should calculate camera transfer time with framesPerTick in 3x2 grid mode (6 frames per tick)", () => {
    // 25 frames, 6 frames per tick, 300ms per tick
    // ceil(25 / 6) = 5 ticks * 300ms = 1500ms = 1.5 seconds
    const est = estimateSeconds("camera", 8000, {
      frames: 25,
      frameIntervalMs: 300,
      framesPerTick: 6,
    });
    expect(est.seconds).toBe(1.5);
    expect(est.approximate).toBe(true);
  });

  it("should correctly estimate camera frames count", () => {
    expect(estimateCameraFrames(0)).toBe(0);
    expect(estimateCameraFrames(150, 150)).toBe(1);
    expect(estimateCameraFrames(151, 150)).toBe(2);
    expect(estimateCameraFrames(300, 150)).toBe(2);
  });

  it("should format duration correctly for 0.4, 12, 200, 3900 seconds and zero bytes", () => {
    expect(formatDuration(0.4)).toBe("under 1 sec");
    expect(formatDuration(12)).toBe("12 sec");
    expect(formatDuration(200)).toBe("3 min 20 sec");
    expect(formatDuration(3900)).toBe("1 hr 5 min");
    expect(formatDuration(0)).toBe("under 1 sec");

    // Zero bytes returns under 1 sec
    const zeroBytesEst = estimateSeconds("internet", 0);
    expect(formatDuration(zeroBytesEst.seconds)).toBe("under 1 sec");
  });
});
