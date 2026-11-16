"use client";

import { useSyncExternalStore, useCallback } from "react";

export type Theme = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "quicksend_theme";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const media =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  const mediaListener = () => {
    applyThemeToDOM(getThemeSnapshot());
    callback();
  };

  media?.addEventListener("change", mediaListener);

  return () => {
    listeners.delete(callback);
    media?.removeEventListener("change", mediaListener);
  };
}

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const currentTheme: Theme =
      stored === "light" || stored === "dark" ? stored : "system";
    applyThemeToDOM(currentTheme);
    return currentTheme;
  } catch {
    return "system";
  }
}

function getServerSnapshot(): Theme {
  return "system";
}

function applyThemeToDOM(theme: Theme): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
    root.classList.remove("light");
    return "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    return "light";
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);

  const resolvedTheme: "light" | "dark" =
    typeof window === "undefined"
      ? "light"
      : theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      ? "dark"
      : "light";

  const setTheme = useCallback((newTheme: Theme) => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      }
    } catch {
      // Storage unavailable
    }
    applyThemeToDOM(newTheme);
    notify();
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    toggleTheme,
    setTheme,
  };
}
