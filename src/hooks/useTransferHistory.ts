"use client";

import { useSyncExternalStore, useCallback } from "react";
import type { TransferHistoryItem } from "@/types/transfer";

export const SESSION_STORAGE_KEY = "quicksend_session_history";
export const MAX_HISTORY_ITEMS = 50;

let memoryHistory: TransferHistoryItem[] | null = null;
const listeners = new Set<() => void>();

function loadFromStorage(): TransferHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getTransferHistorySnapshot(): TransferHistoryItem[] {
  if (memoryHistory === null) {
    memoryHistory = loadFromStorage();
  }
  return memoryHistory;
}

const SERVER_SNAPSHOT: TransferHistoryItem[] = [];
function getServerSnapshot(): TransferHistoryItem[] {
  return SERVER_SNAPSHOT;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Listener error guard
    }
  }
}

export function addTransferHistoryItem(
  item: Omit<TransferHistoryItem, "id" | "timestamp">
): TransferHistoryItem {
  const newItem: TransferHistoryItem = {
    ...item,
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  const current = getTransferHistorySnapshot();
  const updated = [newItem, ...current].slice(0, MAX_HISTORY_ITEMS);
  memoryHistory = updated;

  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Storage full or disabled
  }

  notify();
  return newItem;
}

export function clearTransferHistory(): void {
  memoryHistory = [];
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Storage disabled
  }
  notify();
}

/**
 * Resets memory state - helpful for isolation in unit tests
 */
export function resetTransferHistoryMemory(): void {
  memoryHistory = null;
  notify();
}

export function useTransferHistory() {
  const history = useSyncExternalStore(subscribe, getTransferHistorySnapshot, getServerSnapshot);

  const addHistoryItem = useCallback(
    (item: Omit<TransferHistoryItem, "id" | "timestamp">) => {
      return addTransferHistoryItem(item);
    },
    []
  );

  const clearHistory = useCallback(() => {
    clearTransferHistory();
  }, []);

  return {
    history,
    addHistoryItem,
    clearHistory,
  };
}
