"use client";

import { useSyncExternalStore } from "react";
import type { BrowserCapabilities } from "@/types/mode";

function subscribeNetwork(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getNetworkSnapshot(): boolean {
  return navigator.onLine;
}

function getServerNetworkSnapshot(): boolean {
  return true;
}

/**
 * Real-time network status hook tracking navigator.onLine and online/offline events.
 * Uses useSyncExternalStore for tear-free, hydration-safe state synchronization.
 */
function useNetworkStatus(): boolean {
  return useSyncExternalStore(
    subscribeNetwork,
    getNetworkSnapshot,
    getServerNetworkSnapshot
  );
}

// Immutable capabilities subscription & snapshot
const emptySubscribe = () => () => {};

const serverCapabilities: Omit<BrowserCapabilities, "isOnline"> = Object.freeze({
  hasWebShare: false,
  hasBluetooth: false,
});

let cachedCapabilities: Omit<BrowserCapabilities, "isOnline"> | null = null;

function getCapabilitiesSnapshot(): Omit<BrowserCapabilities, "isOnline"> {
  if (!cachedCapabilities && typeof navigator !== "undefined") {
    cachedCapabilities = Object.freeze({
      hasWebShare: "share" in navigator,
      hasBluetooth: "bluetooth" in navigator,
    });
  }
  return cachedCapabilities ?? serverCapabilities;
}

function getServerCapabilitiesSnapshot(): Omit<BrowserCapabilities, "isOnline"> {
  return serverCapabilities;
}

/**
 * Comprehensive browser capabilities hook detecting online state, Web Share API, and Web Bluetooth API.
 * Uses useSyncExternalStore to prevent cascading re-renders during hydration.
 */
export function useBrowserCapabilities(): BrowserCapabilities {
  const isOnline = useNetworkStatus();
  const caps = useSyncExternalStore(
    emptySubscribe,
    getCapabilitiesSnapshot,
    getServerCapabilitiesSnapshot
  );

  return {
    isOnline,
    hasWebShare: caps.hasWebShare,
    hasBluetooth: caps.hasBluetooth,
  };
}
