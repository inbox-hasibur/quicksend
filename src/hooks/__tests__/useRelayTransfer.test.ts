import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useRelayTransfer } from "../useRelayTransfer";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUpload = vi.fn();
vi.mock("@/lib/upstashBlob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/upstashBlob")>();
  return {
    ...actual,
    upload: (...args: unknown[]) => mockUpload(...args),
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

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/relay/status")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              available: true,
              maxFileBytes: 52428800,
              maxFiles: 5,
              ttlMinutes: 15,
            }),
            { status: 200 }
          )
        );
      }
      if (urlStr.includes("/api/relay/attach")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      if (urlStr.includes("/api/relay/complete")) {
        return Promise.resolve(new Response(JSON.stringify({ deleted: 1 }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
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

  it("handles wrong relay code error without calling complete", async () => {
    let hookData!: ReturnType<typeof useRelayTransfer>;

    await act(async () => {
      root.render(React.createElement(RelayConsumer, { onHook: (h) => (hookData = h) }));
    });

    const fakePayload = {
      salt: "c2FsdA==",
      createdAt: Date.now(),
      items: [
        {
          url: "https://store.blob.vercel-storage.com/relay/123/file.bin",
          pathname: "relay/123/file.bin",
          name: "test.txt",
          size: 10,
          mimeType: "text/plain",
          iv: "aXY=",
        },
      ],
    };

    // Invalid / wrong code
    let threw = false;
    await act(async () => {
      try {
        await hookData.downloadRelay(fakePayload, "INVALID", "123456");
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
});
