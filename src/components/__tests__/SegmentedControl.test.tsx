import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { SegmentedControl } from "@/components/SegmentedControl";

// Enable React act testing environment flag
// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SegmentedControl Component", () => {
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

  const options = [
    { value: "send", label: "Send" },
    { value: "receive", label: "Receive" },
    { value: "settings", label: "Settings" },
  ];

  it("renders all labels and sets tablist role and aria attributes", async () => {
    await act(async () => {
      root.render(
        <SegmentedControl
          options={options}
          value="send"
          onChange={() => {}}
          ariaLabel="Transfer Mode"
        />
      );
    });

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    expect(tablist?.getAttribute("aria-label")).toBe("Transfer Mode");

    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toBe("Send");
    expect(buttons[1].textContent).toBe("Receive");
    expect(buttons[2].textContent).toBe("Settings");

    // Active button has aria-selected="true" and .pill-active class
    expect(buttons[0].getAttribute("aria-selected")).toBe("true");
    expect(buttons[0].classList.contains("pill-active")).toBe(true);

    // Inactive buttons have aria-selected="false"
    expect(buttons[1].getAttribute("aria-selected")).toBe("false");
    expect(buttons[1].classList.contains("pill-active")).toBe(false);
  });

  it("calls onChange when an option button is clicked", async () => {
    const handleChange = vi.fn();

    await act(async () => {
      root.render(
        <SegmentedControl
          options={options}
          value="send"
          onChange={handleChange}
          ariaLabel="Transfer Mode"
        />
      );
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    await act(async () => {
      buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleChange).toHaveBeenCalledWith("receive");
  });

  it("supports right and left arrow keys to navigate and trigger onChange", async () => {
    const handleChange = vi.fn();

    await act(async () => {
      root.render(
        <SegmentedControl
          options={options}
          value="send"
          onChange={handleChange}
          ariaLabel="Transfer Mode"
        />
      );
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    // Press ArrowRight on first option (index 0 -> index 1)
    await act(async () => {
      buttons[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });
    expect(handleChange).toHaveBeenCalledWith("receive");

    // Press ArrowLeft on first option (index 0 -> index 2 / wrapped)
    await act(async () => {
      buttons[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
      );
    });
    expect(handleChange).toHaveBeenCalledWith("settings");
  });
});
