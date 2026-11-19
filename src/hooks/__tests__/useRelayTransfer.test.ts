import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useRelayTransfer } from "../useRelayTransfer";
import { deriveRelayKey, encryptChunk, generateIvPrefix } from "@/lib/relayCrypto";
import { chunkAad } from "@/lib/relayChunks";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockWriteChunk = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockAbort = vi.fn().mockResolvedValue(undefined);
const mockCreateDiskStreamWriter = vi.fn();

vi.mock("@/lib/diskStream", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/diskStream")>();
  return {
    ...actual,
    createDiskStreamWriter: (...args: unknown[]) => mockCreateDiskStreamWriter(...args),
  };
});

function RelayConsumer({
  onHook,
}: {
  onHook: (hook: ReturnType<typeof useRelayTransfer>) => void;
}) {
  const hook = useRelayTransfer();
  onHook(hook);
  return React.createElement(
    "div",
    { "data-testid": "status", "data-error": hook.error || "" },
    hook.error || (hook.relayStatus?.available ? "ready" : "none")
  );
}

describe("useRelayTransfer hook", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/relay/status")) {
        return new Response(
          JSON.stringify({
            available: true,
            maxFileBytes: 209715200,
            maxTransferBytes: 314572800,
            maxFiles: 5,
            chunkBytes: 4194304,
            ttlMinutes: 15,
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes("/api/relay/upload")) {
        const body = JSON.parse(init?.body as string);
        const urls = (body.chunks as { path: string; size: number }[]).map((c) => ({
          path: c.path,
          url: `https://bucket.blob.upstash.io/${c.path}`,
          headers: { Authorization: "Bearer test" },
        }));
        return new Response(JSON.stringify({ urls }), { status: 200 });
      }
      if (urlStr.includes("https://bucket.blob.upstash.io/")) {
        return new Response(null, { status: 200 });
      }
      if (urlStr.includes("/api/relay/attach")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (urlStr.includes("/api/relay/complete")) {
        return new Response(JSON.stringify({ deleted: 1 }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("fetches /api/relay/status on mount", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    expect(hookData.relayStatus?.available).toBe(true);
    expect(hookData.relayStatus?.maxFiles).toBe(5);
    expect(hookData.relayStatus?.maxFileBytes).toBe(209715200);
  });

  it("stops polling when stopPolling is called", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      hookData.pollRelay("123456");
    });

    expect(hookData.isPolling).toBe(true);

    await act(async () => {
      hookData.stopPolling();
    });

    expect(hookData.isPolling).toBe(false);
  });

  it("a 10 MiB file uploads as 2 chunks", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    const tenMb = 10 * 1024 * 1024;
    const file = {
      name: "large.dat",
      size: tenMb,
      type: "application/octet-stream",
      slice: (start: number, end: number) => ({
        arrayBuffer: async () => new Uint8Array(end - start).buffer,
      }),
    } as unknown as File;

    let uploadPayloadChunks: { path: string; size: number }[] = [];
    const putUrls: string[] = [];

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/relay/upload")) {
        const body = JSON.parse(init?.body as string);
        uploadPayloadChunks = body.chunks;
        return new Response(
          JSON.stringify({
            urls: body.chunks.map((c: { path: string }) => ({
              path: c.path,
              url: `https://bucket.blob.upstash.io/${c.path}`,
            })),
          }),
          { status: 200 }
        );
      }
      if (init?.method === "PUT") {
        putUrls.push(urlStr);
        return new Response(null, { status: 200 });
      }
      if (urlStr.includes("/api/relay/attach")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await act(async () => {
      await hookData.startRelayUpload("123456", [file]);
    });

    expect(uploadPayloadChunks.length).toBe(2);
    expect(putUrls.length).toBe(2);
    expect(hookData.chunksTotal).toBe(2);
    expect(hookData.chunksDone).toBe(2);
    expect(hookData.uploadedBytes).toBe(tenMb);
    expect(hookData.relayState).toBe("ready");
    expect(hookData.relayCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  });

  it("a chunk failing twice then succeeding passes", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    const file = {
      name: "onechunk.dat",
      size: 1024,
      type: "application/octet-stream",
      slice: () => ({
        arrayBuffer: async () => new Uint8Array(1024).buffer,
      }),
    } as unknown as File;

    let putAttempts = 0;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/relay/upload")) {
        return new Response(
          JSON.stringify({
            urls: [{ path: "relay/123456/rid/file-0.bin", url: "https://bucket.blob.upstash.io/relay/123456/rid/file-0.bin" }],
          }),
          { status: 200 }
        );
      }
      if (init?.method === "PUT") {
        putAttempts++;
        if (putAttempts <= 2) {
          return new Response("Transient error", { status: 500 });
        }
        return new Response(null, { status: 200 });
      }
      if (urlStr.includes("/api/relay/attach")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await act(async () => {
      await hookData.startRelayUpload("123456", [file]);
    });

    expect(putAttempts).toBe(3);
    expect(hookData.relayState).toBe("ready");
    expect(hookData.chunksDone).toBe(1);
  }, 15000);

  it("a chunk failing 4 times gives the chunk error text", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    const file = {
      name: "failing.dat",
      size: 1024,
      type: "application/octet-stream",
      slice: () => ({
        arrayBuffer: async () => new Uint8Array(1024).buffer,
      }),
    } as unknown as File;

    let putAttempts = 0;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/relay/upload")) {
        return new Response(
          JSON.stringify({
            urls: [{ path: "relay/123456/rid/file-0.bin", url: "https://bucket.blob.upstash.io/relay/123456/rid/file-0.bin" }],
          }),
          { status: 200 }
        );
      }
      if (init?.method === "PUT") {
        putAttempts++;
        return new Response("Forbidden", { status: 403 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await act(async () => {
      await hookData.startRelayUpload("123456", [file]);
    });

    expect(putAttempts).toBe(4);
    expect(hookData.relayState).toBe("error");
    expect(hookData.error).toBe("Upload failed at chunk 1 of 1: HTTP 403");
  }, 15000);

  it("going offline pauses and online resumes", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    const file = {
      name: "offline.dat",
      size: 1024,
      type: "application/octet-stream",
      slice: () => ({
        arrayBuffer: async () => new Uint8Array(1024).buffer,
      }),
    } as unknown as File;

    // Simulate starting while offline
    Object.defineProperty(navigator, "onLine", { value: false });

    let putCalled = false;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/relay/upload")) {
        return new Response(
          JSON.stringify({
            urls: [{ path: "relay/123456/rid/file-0.bin", url: "https://bucket.blob.upstash.io/relay/123456/rid/file-0.bin" }],
          }),
          { status: 200 }
        );
      }
      if (init?.method === "PUT") {
        putCalled = true;
        return new Response(null, { status: 200 });
      }
      if (urlStr.includes("/api/relay/attach")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    let uploadPromise!: Promise<void>;
    await act(async () => {
      uploadPromise = hookData.startRelayUpload("123456", [file]);
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(putCalled).toBe(false);

    // Come back online
    await act(async () => {
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
      await uploadPromise;
    });

    expect(putCalled).toBe(true);
    expect(hookData.relayState).toBe("ready");
  });

  it("a wrong code on the first chunk gives 'Wrong relay code' and complete is not called", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    const fakePayload = {
      salt: "c2FsdA==",
      rid: "0123456789abcdef0123456789abcdef",
      baseUrl: "https://bucket.blob.upstash.io",
      files: [
        {
          id: "0123456789abcdef",
          name: "test.bin",
          size: 100,
          mimeType: "application/octet-stream",
          chunkCount: 1,
          ivPrefix: "AAAAAA==",
        },
      ],
    };

    // Return mock cipher data that cannot decrypt with wrong code
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("bucket.blob.upstash.io")) {
        return new Response(new Uint8Array(116).buffer, { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    let threw = false;
    await act(async () => {
      try {
        await hookData.downloadRelay(fakePayload, "ZZZZ-ZZZZ", "123456");
      } catch (err) {
        threw = true;
        expect((err as Error).message).toBe("Wrong relay code");
      }
    });

    expect(threw).toBe(true);
    expect(hookData.error).toBe("Wrong relay code");
    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/relay/complete",
      expect.anything()
    );
  });

  it("cancel calls complete", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    await act(async () => {
      await hookData.cancelRelay("123456");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/relay/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ roomCode: "123456" }),
      })
    );
    expect(hookData.relayState).toBe("idle");
  });

  it("files over 100 MB use the disk stream helper", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    const mockWriter = {
      fileName: "huge.bin",
      writeChunk: mockWriteChunk,
      close: mockClose,
      abort: mockAbort,
    };
    mockCreateDiskStreamWriter.mockResolvedValue(mockWriter);

    const code = "K7M2-9QXA";
    const salt = "c2FsdA==";
    const key = await deriveRelayKey("K7M29QXA", salt);
    const ivPrefix = generateIvPrefix();
    const fileId = "0123456789abcdef";

    // 1 chunk of plaintext encrypted properly
    const plain = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const aad = chunkAad(fileId, 0, 1);
    const cipher = await encryptChunk(key, plain, ivPrefix, 0, aad);

    const hugeSize = 105 * 1024 * 1024; // > 100 MB
    const fakePayload = {
      salt,
      rid: "0123456789abcdef0123456789abcdef",
      baseUrl: "https://bucket.blob.upstash.io",
      files: [
        {
          id: fileId,
          name: "huge.bin",
          size: hugeSize,
          mimeType: "application/octet-stream",
          chunkCount: 1,
          ivPrefix,
        },
      ],
    };

    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("bucket.blob.upstash.io")) {
        return new Response(cipher, { status: 200 });
      }
      if (urlStr.includes("/api/relay/complete")) {
        return new Response(JSON.stringify({ deleted: 1 }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await act(async () => {
      await hookData.downloadRelay(fakePayload, code, "123456");
    });

    expect(mockCreateDiskStreamWriter).toHaveBeenCalledWith("huge.bin");
    expect(mockWriteChunk).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockAbort).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/relay/complete",
      expect.anything()
    );
  });
});
