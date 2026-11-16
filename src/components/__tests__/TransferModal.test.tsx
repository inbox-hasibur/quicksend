import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { TransferModal } from "@/components/TransferModal";
import type { TransferProgressState } from "@/types/transfer";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("TransferModal Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("should not render when progress status is idle", async () => {
    const idleProgress: TransferProgressState = {
      status: "idle",
      itemType: "file",
      bytesTransferred: 0,
      totalBytes: 0,
      progressPercentage: 0,
      speedBps: 0,
    };

    await act(async () => {
      root.render(
        <TransferModal
          progress={idleProgress}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    expect(container.innerHTML).toBe("");
  });

  it("should render connecting state without 0 Bytes placeholder and with Cancel button", async () => {
    const connectingProgress: TransferProgressState = {
      status: "connecting",
      itemType: "file",
      bytesTransferred: 0,
      totalBytes: 0,
      progressPercentage: 0,
      speedBps: 0,
    };

    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <TransferModal
          progress={connectingProgress}
          roomCode="834291"
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain("Connecting...");
    expect(container.textContent).toContain("Connecting to sender (834-291)...");
    expect(container.textContent).not.toContain("0 Bytes");
    expect(container.textContent).not.toContain("File Payload");

    const cancelBtn = container.querySelector('[data-testid="cancel-transfer-btn"]') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn.textContent).toContain("Cancel Transfer");

    await act(async () => {
      cancelBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("should not render when isOpen is false (keeping Sender QR unblurred while waiting)", async () => {
    const connectingProgress: TransferProgressState = {
      status: "connecting",
      itemType: "file",
      bytesTransferred: 0,
      totalBytes: 0,
      progressPercentage: 0,
      speedBps: 0,
    };

    await act(async () => {
      root.render(
        <TransferModal
          isOpen={false}
          progress={connectingProgress}
          roomCode="123456"
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    // Must be completely unrendered
    expect(container.innerHTML).toBe("");
  });

  it("should display real file metadata and never 0 Bytes when selected files are provided during connecting", async () => {
    const connectingWithFile: TransferProgressState = {
      status: "connecting",
      itemType: "file",
      fileName: "backup.zip",
      fileSize: 10485760,
      bytesTransferred: 0,
      totalBytes: 10485760,
      progressPercentage: 0,
      speedBps: 0,
    };

    await act(async () => {
      root.render(
        <TransferModal
          progress={connectingWithFile}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("backup.zip");
    expect(container.textContent).toContain("10 MB");
    expect(container.textContent).not.toContain("0 Bytes");
    expect(container.textContent).not.toContain("File Payload");
  });

  it("should render transferring state with Cancel Transfer button that calls onClose", async () => {
    const transferringProgress: TransferProgressState = {
      status: "transferring",
      itemType: "file",
      fileName: "presentation.pdf",
      fileSize: 10485760,
      bytesTransferred: 5242880,
      totalBytes: 10485760,
      progressPercentage: 50,
      speedBps: 1048576,
    };

    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <TransferModal
          progress={transferringProgress}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain("presentation.pdf");
    const cancelBtn = container.querySelector('[data-testid="cancel-transfer-btn"]') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn.textContent).toContain("Cancel Transfer");

    await act(async () => {
      cancelBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("should render error dialog and dismiss immediately when Close button is clicked", async () => {
    const errorProgress: TransferProgressState = {
      status: "error",
      itemType: "file",
      fileName: "test-doc.pdf",
      fileSize: 1024,
      errorMessage: "Direct P2P connection timed out or blocked by restrictive firewall/symmetric NAT.",
      bytesTransferred: 0,
      totalBytes: 1024,
      progressPercentage: 0,
      speedBps: 0,
    };

    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <TransferModal
          progress={errorProgress}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain("Transfer Error");
    expect(container.textContent).toContain("Direct P2P connection timed out");

    const closeBtn = container.querySelector('[data-testid="transfer-modal-bottom-close"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    // Modal is dismissed immediately
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("should dismiss immediately when header X button is clicked", async () => {
    const errorProgress: TransferProgressState = {
      status: "error",
      itemType: "file",
      fileName: "image.png",
      fileSize: 2048,
      errorMessage: "DataChannel error occurred during transfer.",
      bytesTransferred: 0,
      totalBytes: 2048,
      progressPercentage: 0,
      speedBps: 0,
    };

    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <TransferModal
          progress={errorProgress}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={onClose}
        />
      );
    });

    const xBtn = container.querySelector('[data-testid="transfer-modal-x-close"]') as HTMLButtonElement;
    expect(xBtn).not.toBeNull();

    await act(async () => {
      xBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("should dismiss when Escape key is pressed", async () => {
    const errorProgress: TransferProgressState = {
      status: "error",
      itemType: "file",
      errorMessage: "Network disconnected",
      bytesTransferred: 0,
      totalBytes: 0,
      progressPercentage: 0,
      speedBps: 0,
    };

    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <TransferModal
          progress={errorProgress}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain("Transfer Error");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
