"use client";

import { useState, useCallback } from "react";
import type { TransferHistoryItem } from "@/types/transfer";

const SESSION_STORAGE_KEY = "share_anything_session_history";

export function useTransferHistory() {
  const [history, setHistory] = useState<TransferHistoryItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addHistoryItem = useCallback(
    (item: Omit<TransferHistoryItem, "id" | "timestamp">) => {
      const newItem: TransferHistoryItem = {
        ...item,
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        const updated = [newItem, ...prev].slice(0, 50); // Keep last 50 items
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
          }
        } catch {
          // Storage full or disabled
        }
        return updated;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }, []);

  return {
    history,
    addHistoryItem,
    clearHistory,
  };
}
