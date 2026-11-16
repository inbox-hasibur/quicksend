import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { UltrasonicCard } from "@/components/UltrasonicCard";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("UltrasonicCard Component", () => {
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

  it("should render experimental badge, broadcast, and listen controls", async () => {
    await act(async () => {
      root.render(<UltrasonicCard />);
    });

    // Check title, badge and presets
    expect(container.textContent).toContain("Ultrasonic Sound Data Transfer");
    expect(container.textContent).toContain("Experimental");
    expect(container.textContent).toContain("Near-Ultrasonic (18–20 kHz)");
    expect(container.textContent).toContain("Audible Chirp (1.5–3 kHz)");

    // Check 2-partition layout
    expect(container.textContent).toContain("Select Payload (Files or Text)");
    expect(container.textContent).toContain("Send (Speaker)");
    expect(container.textContent).toContain("Receive (Mic)");
    expect(container.textContent).toContain("Transmit via Sound");
  });

  it("should switch to microphone receiver view when Receive tab is clicked", async () => {
    await act(async () => {
      root.render(<UltrasonicCard />);
    });

    const listenTabBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Receive (Mic)")
    );
    expect(listenTabBtn).toBeDefined();

    await act(async () => {
      listenTabBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Microphone scanner idle");
    expect(container.textContent).toContain("Start Microphone Scanner");
  });
});
