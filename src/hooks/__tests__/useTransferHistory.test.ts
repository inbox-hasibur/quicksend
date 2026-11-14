import { describe, it, expect, beforeEach } from "vitest";
import {
  getTransferHistorySnapshot,
  addTransferHistoryItem,
  clearTransferHistory,
  resetTransferHistoryMemory,
  SESSION_STORAGE_KEY,
  MAX_HISTORY_ITEMS,
} from "../useTransferHistory";

describe("useTransferHistory Store", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetTransferHistoryMemory();
  });

  it("initializes with an empty history array", () => {
    const history = getTransferHistorySnapshot();
    expect(history).toEqual([]);
  });

  it("adds a file item with generated id and timestamp", () => {
    const item = addTransferHistoryItem({
      direction: "sent",
      mode: "Via Internet",
      itemType: "file",
      name: "document.pdf",
      size: 1048576,
      status: "completed",
    });

    expect(item.id).toMatch(/^hist_\d+_/);
    expect(item.timestamp).toBeGreaterThan(0);
    expect(item.name).toBe("document.pdf");

    const history = getTransferHistorySnapshot();
    expect(history).toHaveLength(1);
    expect(history[0].name).toBe("document.pdf");
  });

  it("adds a text item with snippet preserved", () => {
    addTransferHistoryItem({
      direction: "received",
      mode: "Same Wi-Fi",
      itemType: "text",
      name: "Meeting link...",
      textSnippet: "https://meet.google.com/xyz-abc-def",
      size: 35,
      status: "completed",
    });

    const history = getTransferHistorySnapshot();
    expect(history).toHaveLength(1);
    expect(history[0].itemType).toBe("text");
    expect(history[0].textSnippet).toBe("https://meet.google.com/xyz-abc-def");
  });

  it("orders items with newest first", () => {
    addTransferHistoryItem({
      direction: "sent",
      mode: "Via Internet",
      itemType: "file",
      name: "first.png",
      status: "completed",
    });

    addTransferHistoryItem({
      direction: "sent",
      mode: "Via Internet",
      itemType: "file",
      name: "second.png",
      status: "completed",
    });

    const history = getTransferHistorySnapshot();
    expect(history).toHaveLength(2);
    expect(history[0].name).toBe("second.png");
    expect(history[1].name).toBe("first.png");
  });

  it("caps maximum history items at MAX_HISTORY_ITEMS (50)", () => {
    for (let i = 0; i < 60; i++) {
      addTransferHistoryItem({
        direction: "sent",
        mode: "Hotspot",
        itemType: "file",
        name: `file_${i}.txt`,
        status: "completed",
      });
    }

    const history = getTransferHistorySnapshot();
    expect(history).toHaveLength(MAX_HISTORY_ITEMS);
    expect(history[0].name).toBe("file_59.txt");
    expect(history[MAX_HISTORY_ITEMS - 1].name).toBe("file_10.txt");
  });

  it("clears all history items", () => {
    addTransferHistoryItem({
      direction: "sent",
      mode: "Nearby",
      itemType: "file",
      name: "photo.jpg",
      status: "completed",
    });

    expect(getTransferHistorySnapshot()).toHaveLength(1);

    clearTransferHistory();
    expect(getTransferHistorySnapshot()).toHaveLength(0);
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("syncs with sessionStorage", () => {
    addTransferHistoryItem({
      direction: "received",
      mode: "Via Internet",
      itemType: "file",
      name: "archive.zip",
      size: 5000000,
      status: "completed",
    });

    const rawStored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    expect(rawStored).toBeTruthy();
    const parsed = JSON.parse(rawStored!);
    expect(parsed[0].name).toBe("archive.zip");
  });
});
