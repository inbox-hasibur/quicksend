"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.addEventListener?.("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    mediaQuery.removeEventListener?.("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function getStandaloneSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandaloneMedia || isIosStandalone;
}

function getServerStandaloneSnapshot(): boolean {
  return false;
}

const emptySubscribe = () => () => {};

function getIsIosSnapshot(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleDevice = /iphone|ipad|ipod/i.test(ua);
  const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleDevice || isIpadOS;
}

function getServerIsIosSnapshot(): boolean {
  return false;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [manuallyInstalled, setManuallyInstalled] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getServerStandaloneSnapshot
  );

  const isIos = useSyncExternalStore(
    emptySubscribe,
    getIsIosSnapshot,
    getServerIsIosSnapshot
  );

  const isInstalled = isStandalone || manuallyInstalled;

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setManuallyInstalled(true);
      setDeferredPrompt(null);
      setShowManualGuide(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setManuallyInstalled(true);
          setShowManualGuide(false);
        }
        setDeferredPrompt(null);
      } catch {
        setShowManualGuide(true);
      }
    } else {
      setShowManualGuide(true);
    }
  }, [deferredPrompt]);

  return {
    canShowInstall: !isInstalled,
    isInstalled,
    isIos,
    promptInstall,
    showManualGuide,
    setShowManualGuide,
  };
}
