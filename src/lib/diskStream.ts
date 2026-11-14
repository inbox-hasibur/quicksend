/**
 * Large-file disk streaming fallback using File System Access API.
 * Prevents tab RAM overflow for files > 100MB in supported browsers (Chrome, Edge).
 * Gracefully falls back to in-memory Blob reassembly when unsupported (Safari, Firefox).
 */

export const DISK_STREAM_THRESHOLD = 100 * 1024 * 1024; // 100 MB

export interface DiskStreamWriter {
  fileName: string;
  writeChunk(chunk: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

interface FileSystemWritableFileStreamLike {
  write(data: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

/**
 * Checks if File System Access API (window.showSaveFilePicker) is supported in current context.
 */
export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker ===
      "function"
  );
}

/**
 * Prompts user to select a download destination and returns a streaming writer.
 * Returns null if unsupported, user cancels the picker, or permission is denied.
 */
export async function createDiskStreamWriter(
  suggestedName: string
): Promise<DiskStreamWriter | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }

  try {
    const picker = (
      window as unknown as {
        showSaveFilePicker: (opts: { suggestedName: string }) => Promise<FileSystemFileHandleLike>;
      }
    ).showSaveFilePicker;

    const handle = await picker({ suggestedName });
    const writable = await handle.createWritable();

    return {
      fileName: suggestedName,
      writeChunk: async (chunk: ArrayBuffer) => {
        await writable.write(chunk);
      },
      close: async () => {
        await writable.close();
      },
      abort: async () => {
        if (typeof writable.abort === "function") {
          await writable.abort().catch(() => {});
        }
      },
    };
  } catch {
    // User cancelled the file picker dialog or browser disallowed access
    return null;
  }
}
