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

  it("shows the relay download card with the Encrypted badge and Download button", async () => {
    const fakeRelay = {
      salt: "c2FsdA==",
      createdAt: Date.now(),
      items: [{ name: "report.pdf", size: 1048576 }],
    };

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
          relayPayload={fakeRelay}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Encrypted Cloud Relay Ready");
    expect(container.textContent).toContain("Encrypted");
    expect(container.textContent).toContain("report.pdf");
    expect(container.textContent).toContain("1 MB");
    expect(container.textContent).toContain("Relay code");

    const downloadBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Download")
    );
    expect(downloadBtn).toBeDefined();
  });

  it("shows an error when wrong code is entered during relay download", async () => {
    const fakeRelay = {
      salt: "c2FsdA==",
      createdAt: Date.now(),
      items: [{ name: "secret.bin", size: 500 }],
    };

    const idleProgress: TransferProgressState = {
      status: "idle",
      itemType: "file",
      bytesTransferred: 0,
      totalBytes: 0,
      progressPercentage: 0,
      speedBps: 0,
    };

    const onDownload = vi.fn().mockRejectedValue(new Error("Wrong relay code"));

    await act(async () => {
      root.render(
        <TransferModal
          progress={idleProgress}
          relayPayload={fakeRelay}
          onDownloadRelay={onDownload}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    const input = container.querySelector("input[placeholder*='XXXX-XXXX']") as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(input, "WRONG-CD");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const downloadBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Download")
    );

    await act(async () => {
      downloadBtn?.click();
    });

    expect(onDownload).toHaveBeenCalledWith("WRONG-CD");
    expect(container.textContent).toContain("Wrong relay code");
  });

  it("shows 'Send via encrypted cloud relay' button in error state when relay is available", async () => {
    const errorProgress: TransferProgressState = {
      status: "error",
      errorMessage: "Blocked by 4G mobile network or firewall — TURN relay required",
      itemType: "file",
      bytesTransferred: 0,
      totalBytes: 0,
      progressPercentage: 0,
      speedBps: 0,
    };

    const onRelay = vi.fn();

    await act(async () => {
      root.render(
        <TransferModal
          progress={errorProgress}
          onRelay={onRelay}
          isRelayAvailable={true}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    const relayBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Send via encrypted cloud relay")
    );
    expect(relayBtn).toBeDefined();

    await act(async () => {
      relayBtn?.click();
    });

    expect(onRelay).toHaveBeenCalledTimes(1);
  });

  it("should show sender connecting label and render diagnostic hint on error", async () => {
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
          progress={connectingProgress}
          role="sender"
          peerName="Pixel 8"
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Connecting to Pixel 8...");

    const errorProgress: TransferProgressState = {
      status: "error",
      itemType: "file",
      bytesTransferred: 0,
      totalBytes: 0,
      progressPercentage: 0,
      speedBps: 0,
      errorMessage: "Connection timed out",
    };

    await act(async () => {
      root.render(
        <TransferModal
          progress={errorProgress}
          diagnosticHint="ICE: failed • host: 2, srflx: 1, relay: 0"
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("ICE: failed • host: 2, srflx: 1, relay: 0");
  });
});
