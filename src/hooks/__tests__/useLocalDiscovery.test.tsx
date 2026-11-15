import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { act, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { useLocalDiscovery } from "../useLocalDiscovery";
import {
  getLocalDeviceProfile,
  getServerDeviceProfile,
  resetDeviceProfileCache,
  SERVER_DEVICE_PROFILE,
} from "@/lib/deviceIdentity";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function DiscoveryConsumer({
  onHook,
}: {
  onHook: (hook: ReturnType<typeof useLocalDiscovery>) => void;
}) {
  const [, setRerenderCount] = useState(0);
  const hook = useLocalDiscovery(false);
  onHook(hook);
  return (
    <div>
      <span data-testid="id">{hook.profile.id}</span>
      <span data-testid="name">{hook.profile.name}</span>
      <button
        data-testid="rerender-btn"
        onClick={() => setRerenderCount((c) => c + 1)}
      >
        Rerender
      </button>
    </div>
  );
}

describe("useLocalDiscovery and Snapshot Stability", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetDeviceProfileCache();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock global fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        networkId: "lan_test",
        peers: [],
      }),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("guarantees getLocalDeviceProfile referential identity across repeated calls", () => {
    const ref1 = getLocalDeviceProfile();
    const ref2 = getLocalDeviceProfile();
    const ref3 = getLocalDeviceProfile();

    expect(Object.is(ref1, ref2)).toBe(true);
    expect(Object.is(ref2, ref3)).toBe(true);
    expect(ref1.id).toBeDefined();
    expect(ref1.avatarEmoji).toBeDefined();
  });

  it("guarantees getServerDeviceProfile returns static frozen constant reference", () => {
    const s1 = getServerDeviceProfile();
    const s2 = getServerDeviceProfile();

    expect(Object.is(s1, s2)).toBe(true);
    expect(Object.is(s1, SERVER_DEVICE_PROFILE)).toBe(true);
    expect(Object.isFrozen(SERVER_DEVICE_PROFILE)).toBe(true);
  });

  it("renders useLocalDiscovery in React 19 without infinite-loop or getSnapshot warnings", async () => {
    let hookData!: ReturnType<typeof useLocalDiscovery>;

    await act(async () => {
      root.render(<DiscoveryConsumer onHook={(h) => (hookData = h)} />);
    });

    // Check that React did not log any getSnapshot cache warnings or update depth errors
    const hasGetSnapshotWarning = consoleErrorSpy.mock.calls.some((args: unknown[]) =>
      args.some(
        (arg: unknown) =>
          typeof arg === "string" &&
          (arg.includes("getSnapshot should be cached") ||
            arg.includes("Maximum update depth exceeded"))
      )
    );

    expect(hasGetSnapshotWarning).toBe(false);
    expect(hookData.profile.id).toMatch(/^dev_/);
    expect(hookData.profile.avatarEmoji).toBeDefined();
    expect(hookData.profile.codename).toBeDefined();
  });

  it("maintains profile referential stability across parent re-renders", async () => {
    let hookData!: ReturnType<typeof useLocalDiscovery>;

    await act(async () => {
      root.render(<DiscoveryConsumer onHook={(h) => (hookData = h)} />);
    });

    const initialProfileRef = hookData.profile;

    // Trigger component re-render
    const btn = container.querySelector("[data-testid='rerender-btn']") as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });

    // Profile reference must remain identical across re-renders
    expect(Object.is(hookData.profile, initialProfileRef)).toBe(true);
  });

  it("updates cached profile reference and notifies subscribers when cycling avatar", async () => {
    let hookData!: ReturnType<typeof useLocalDiscovery>;

    await act(async () => {
      root.render(<DiscoveryConsumer onHook={(h) => (hookData = h)} />);
    });

    const initialEmoji = hookData.profile.avatarEmoji;

    await act(async () => {
      hookData.cycleAvatar();
    });

    expect(hookData.profile.avatarEmoji).not.toBe(initialEmoji);
  });

  it("exposes pin from announce response and supports lookupPin and beamToPeer", async () => {
    let hookData!: ReturnType<typeof useLocalDiscovery>;

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, opts?: RequestInit) => {
      const body = opts?.body ? JSON.parse(opts.body as string) : {};
      if (body.action === "announce") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            networkId: "lan_test",
            peers: [],
            pin: "7890",
          }),
        };
      }
      if (body.action === "pairLookup") {
        if (body.pin === "1234") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              found: true,
              peerId: "target_peer_id",
              name: "Bob Phone",
              avatar: "🦁",
              os: "Android",
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ found: false }),
        };
      }
      if (body.action === "beam") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    });

    await act(async () => {
      root.render(<DiscoveryConsumer onHook={(h) => (hookData = h)} />);
    });

    await act(async () => {
      await hookData.refreshPeers();
    });

    expect(hookData.pin).toBe("7890");

    let peer: Awaited<ReturnType<typeof hookData.lookupPin>> = null;
    await act(async () => {
      peer = await hookData.lookupPin("1234");
    });
    expect(peer).toEqual(
      expect.objectContaining({
        id: "target_peer_id",
        name: "Bob Phone",
        avatarEmoji: "🦁",
        os: "Android",
      })
    );

    let notFound: Awaited<ReturnType<typeof hookData.lookupPin>> = null;
    await act(async () => {
      notFound = await hookData.lookupPin("9999");
    });
    expect(notFound).toBeNull();

    // Verify beamToPeer accepting peer object
    await act(async () => {
      await hookData.beamToPeer(peer!, "ROOM-TEST");
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/discover",
      expect.objectContaining({
        body: expect.stringContaining('"targetDeviceId":"target_peer_id"'),
      })
    );
  });
});
