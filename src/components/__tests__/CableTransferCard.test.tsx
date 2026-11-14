import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { CableTransferCard } from "@/components/CableTransferCard";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("CableTransferCard Component", () => {
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

  it("should render cable line speed guidance and session PIN controls", async () => {
    await act(async () => {
      root.render(<CableTransferCard />);
    });

    // Check title and line speed indicator
    expect(container.textContent).toContain("Via Cable");
    expect(container.textContent).toContain("Direct Cable Link");
    expect(container.textContent).toContain("WebUSB & Serial");

    // Check line speed hardware guidance
    expect(container.textContent).toContain("Gigabit Hardware Throughput");
    expect(container.textContent).toContain("Host Cable Session PIN");
    expect(container.textContent).toContain("Connect to Host Cable PIN");
  });

  it("should toggle to WebUSB & Serial tab when clicked", async () => {
    await act(async () => {
      root.render(<CableTransferCard />);
    });

    const hardwareTabBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("WebUSB & Serial")
    );
    expect(hardwareTabBtn).toBeDefined();

    await act(async () => {
      hardwareTabBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("WebUSB Interface");
    expect(container.textContent).toContain("Serial COM Port");
  });
});
