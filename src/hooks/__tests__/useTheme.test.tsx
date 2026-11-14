import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useTheme, THEME_STORAGE_KEY } from "../useTheme";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ThemeConsumer({
  onHook,
}: {
  onHook: (hook: ReturnType<typeof useTheme>) => void;
}) {
  const hook = useTheme();
  onHook(hook);
  return <div data-testid="resolved">{hook.resolvedTheme}</div>;
}

describe("useTheme hook", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
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

  it("initializes with default system theme and sets light mode by default", async () => {
    let hookData!: ReturnType<typeof useTheme>;

    await act(async () => {
      root.render(<ThemeConsumer onHook={(h) => (hookData = h)} />);
    });

    expect(hookData.theme).toBe("system");
    expect(hookData.resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("toggles between light and dark updating localStorage and DOM class", async () => {
    let hookData!: ReturnType<typeof useTheme>;

    await act(async () => {
      root.render(<ThemeConsumer onHook={(h) => (hookData = h)} />);
    });

    await act(async () => {
      hookData.toggleTheme();
    });

    expect(hookData.resolvedTheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await act(async () => {
      hookData.toggleTheme();
    });

    expect(hookData.resolvedTheme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("reads stored preference from localStorage", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    let hookData!: ReturnType<typeof useTheme>;

    await act(async () => {
      root.render(<ThemeConsumer onHook={(h) => (hookData = h)} />);
    });

    expect(hookData.theme).toBe("dark");
    expect(hookData.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
