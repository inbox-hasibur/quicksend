import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { SpeedIndicator, getSpeedColorClass } from "@/components/SpeedIndicator";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SpeedIndicator Component", () => {
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

  it("should render explicit 'Speed' text label and meter accessibility role", async () => {
    await act(async () => {
      root.render(<SpeedIndicator speedBars={4} />);
    });

    expect(container.textContent).toContain("Speed");
    const meter = container.querySelector('[role="meter"]');
    expect(meter).not.toBeNull();
    expect(meter?.getAttribute("aria-valuenow")).toBe("4");
    expect(meter?.getAttribute("aria-valuemax")).toBe("5");
  });

  it("should render correct filled and unfilled segment counts for each speed tier", async () => {
    await act(async () => {
      root.render(<SpeedIndicator speedBars={5} />);
    });
    let filled = container.querySelectorAll('[data-filled="true"]');
    let unfilled = container.querySelectorAll('[data-filled="false"]');
    expect(filled.length).toBe(5);
    expect(unfilled.length).toBe(0);

    // 4 of 5 (e.g. Internet)
    await act(async () => {
      root.render(<SpeedIndicator speedBars={4} />);
    });
    filled = container.querySelectorAll('[data-filled="true"]');
    unfilled = container.querySelectorAll('[data-filled="false"]');
    expect(filled.length).toBe(4);
    expect(unfilled.length).toBe(1);

    // 3 of 5 (e.g. Bluetooth)
    await act(async () => {
      root.render(<SpeedIndicator speedBars={3} />);
    });
    filled = container.querySelectorAll('[data-filled="true"]');
    unfilled = container.querySelectorAll('[data-filled="false"]');
    expect(filled.length).toBe(3);
    expect(unfilled.length).toBe(2);

    // 2 of 5 (e.g. Camera Scan)
    await act(async () => {
      root.render(<SpeedIndicator speedBars={2} />);
    });
    filled = container.querySelectorAll('[data-filled="true"]');
    unfilled = container.querySelectorAll('[data-filled="false"]');
    expect(filled.length).toBe(2);
    expect(unfilled.length).toBe(3);
  });

  it("should map speed tiers to high-contrast colors correctly", () => {
    expect(getSpeedColorClass(5)).toContain("emerald");
    expect(getSpeedColorClass(4)).toContain("indigo");
    expect(getSpeedColorClass(3)).toContain("blue");
    expect(getSpeedColorClass(2)).toContain("amber");
    expect(getSpeedColorClass(1)).toContain("amber");
  });

  it("should respect showIcon and showLabel overrides", async () => {
    await act(async () => {
      root.render(<SpeedIndicator speedBars={3} showIcon={false} showLabel={false} />);
    });
    expect(container.textContent).not.toContain("Speed");
    expect(container.querySelector("svg")).toBeNull();

    await act(async () => {
      root.render(<SpeedIndicator speedBars={3} showIcon={true} showLabel={true} />);
    });
    expect(container.textContent).toContain("Speed");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
