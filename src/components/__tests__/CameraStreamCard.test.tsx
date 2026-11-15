import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { CameraStreamCard } from "@/components/CameraStreamCard";
import { encodeFileToOpticalFrames, buildParityFrames } from "@/lib/opticalDataStream";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let quadDecodeCb: ((text: string) => void) | null = null;
let mockIsRunning = false;
const mockQuadStop = vi.fn().mockImplementation(async () => {
  mockIsRunning = false;
});
const mockQuadStart = vi.fn().mockImplementation(async (onDecode: (text: string) => void) => {
  mockIsRunning = true;
  quadDecodeCb = onDecode;
});

vi.mock("@/hooks/useQuadScanner", () => ({
  useQuadScanner: () => ({
    containerRef: { current: null },
    start: mockQuadStart,
    stop: mockQuadStop,
    get isRunning() {
      return mockIsRunning;
    },
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

describe("CameraStreamCard Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    quadDecodeCb = null;

    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();

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

  it("renders default sender layout as Single and density as Medium without advisory banners", async () => {
    await act(async () => {
      root.render(React.createElement(CameraStreamCard));
    });

    expect(container.textContent).toContain("Via Camera Scan");
    expect(container.textContent).toContain("Stream / Send");
    expect(container.textContent).toContain("Scan / Receive");

    // Must NOT contain any large payload advisory banner
    expect(container.textContent?.toLowerCase()).not.toContain("large payload advisory");
  });

  it("completes optical receive flow with parity recovery, stops camera, and presents Save / Download button", async () => {
    await act(async () => {
      root.render(React.createElement(CameraStreamCard));
    });

    // Switch role to Receive
    const receiveTab = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Scan / Receive")
    );
    expect(receiveTab).toBeDefined();

    await act(async () => {
      receiveTab!.click();
    });

    // Start camera scanner
    const startCamBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Start Camera")
    );
    expect(startCamBtn).toBeDefined();

    await act(async () => {
      startCamBtn!.click();
    });

    expect(mockQuadStart).toHaveBeenCalledTimes(1);
    expect(quadDecodeCb).toBeTypeOf("function");

    // Prepare 3-chunk payload (30 bytes, 10 bytes/chunk)
    const rawBytes = new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);
    const file = new File([rawBytes], "camera-test.bin", {
      type: "application/octet-stream",
    });

    const dataFrames = await encodeFileToOpticalFrames(file, 10);
    const parityFrames = buildParityFrames(dataFrames, 10);
    expect(dataFrames.length).toBe(3);
    expect(parityFrames.length).toBe(1);

    // Ingest chunk 0
    await act(async () => {
      await quadDecodeCb!(dataFrames[0].encodedPayload);
    });

    // Ingest chunk 2 (intentionally skipping chunk 1 to trigger parity recovery)
    await act(async () => {
      await quadDecodeCb!(dataFrames[2].encodedPayload);
    });

    // Feed parity frame for group 0, which automatically recovers chunk 1
    await act(async () => {
      await quadDecodeCb!(parityFrames[0].encodedPayload);
    });

    // Verify camera stopped cleanly
    expect(mockQuadStop).toHaveBeenCalledTimes(1);

    // Verify completed UI rendered
    expect(container.textContent).toContain("Transfer Complete!");
    expect(container.textContent).toContain("camera-test.bin");

    // Verify big prominent Save / Download File button exists
    const downloadBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Save / Download File")
    );
    expect(downloadBtn).toBeDefined();

    // Verify download trigger
    await act(async () => {
      downloadBtn!.click();
    });

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });
});
