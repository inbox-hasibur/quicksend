import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DISK_STREAM_THRESHOLD,
  isFileSystemAccessSupported,
  createDiskStreamWriter,
} from "@/lib/diskStream";

describe("Large-file disk streaming fallback", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("should define 100MB as the disk streaming threshold", () => {
    expect(DISK_STREAM_THRESHOLD).toBe(100 * 1024 * 1024);
  });

  it("should detect File System Access API support correctly", () => {
    // In happy-dom by default, showSaveFilePicker is not implemented
    expect(isFileSystemAccessSupported()).toBe(false);

    // Mock showSaveFilePicker
    // @ts-expect-error mock window picker
    globalThis.window.showSaveFilePicker = vi.fn();
    expect(isFileSystemAccessSupported()).toBe(true);
  });

  it("should return null if File System Access API is unsupported", async () => {
    // @ts-expect-error remove picker
    delete globalThis.window.showSaveFilePicker;
    const writer = await createDiskStreamWriter("large-file.mp4");
    expect(writer).toBeNull();
  });

  it("should return null if user cancels the save picker", async () => {
    // @ts-expect-error mock window picker rejection
    globalThis.window.showSaveFilePicker = vi.fn().mockRejectedValue(new Error("User cancelled"));

    const writer = await createDiskStreamWriter("large-file.mp4");
    expect(writer).toBeNull();
  });

  it("should create a writer that streams chunks and closes writable stream", async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockAbort = vi.fn().mockResolvedValue(undefined);

    // @ts-expect-error mock window picker success
    globalThis.window.showSaveFilePicker = vi.fn().mockResolvedValue({
      createWritable: vi.fn().mockResolvedValue({
        write: mockWrite,
        close: mockClose,
        abort: mockAbort,
      }),
    });

    const writer = await createDiskStreamWriter("video.mkv");
    expect(writer).not.toBeNull();
    if (!writer) return;

    expect(writer.fileName).toBe("video.mkv");

    const testChunk = new Uint8Array([1, 2, 3, 4]).buffer;
    await writer.writeChunk(testChunk);
    expect(mockWrite).toHaveBeenCalledWith(testChunk);

    await writer.close();
    expect(mockClose).toHaveBeenCalled();
  });
});
