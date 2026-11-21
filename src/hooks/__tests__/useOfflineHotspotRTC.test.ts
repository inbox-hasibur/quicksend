import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useOfflineHotspotRTC, waitForIceGathering } from "../useOfflineHotspotRTC";
import { decodeOpticalSdp } from "@/lib/opticalSdp";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("waitForIceGathering helper", () => {
  it("resolves immediately if iceGatheringState is complete", async () => {
    const mockPc = {
      iceGatheringState: "complete",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as RTCPeerConnection;

    await expect(waitForIceGathering(mockPc, 1000)).resolves.toBeUndefined();
    expect(mockPc.addEventListener).not.toHaveBeenCalled();
  });

  it("resolves when null candidate is encountered", async () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    const mockPc = {
      iceGatheringState: "gathering",
      addEventListener: vi.fn((event, cb) => {
        listeners[event] = cb;
      }),
      removeEventListener: vi.fn(),
    } as unknown as RTCPeerConnection;

    const promise = waitForIceGathering(mockPc, 2000);
    expect(listeners.icecandidate).toBeDefined();

    listeners.icecandidate({ candidate: null });
    await expect(promise).resolves.toBeUndefined();
    expect(mockPc.removeEventListener).toHaveBeenCalled();
  });

  it("resolves on safety timeout if gathering never finishes", async () => {
    vi.useFakeTimers();
    const mockPc = {
      iceGatheringState: "gathering",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as RTCPeerConnection;

    const promise = waitForIceGathering(mockPc, 500);
    vi.advanceTimersByTime(600);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

describe("useOfflineHotspotRTC Hook", () => {
  let container: HTMLDivElement;
  let root: Root;
  let currentHook: ReturnType<typeof useOfflineHotspotRTC>;
  const mockPcs: MockRTCPeerConnection[] = [];

  class MockRTCDataChannel {
    binaryType = "blob";
    readyState = "open";
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((e: { data: unknown }) => void) | null = null;
    send = vi.fn();
    close = vi.fn();
    bufferedAmount = 0;
    bufferedAmountLowThreshold = 0;
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
  }

  class MockRTCPeerConnection {
    iceServers: unknown[];
    iceConnectionState = "new";
    iceGatheringState = "complete";
    signalingState = "stable";
    localDescription: RTCSessionDescriptionInit | null = null;
    remoteDescription: RTCSessionDescriptionInit | null = null;
    oniceconnectionstatechange: (() => void) | null = null;
    ondatachannel: ((ev: { channel: MockRTCDataChannel }) => void) | null = null;
    createdDataChannel: MockRTCDataChannel | null = null;

    addEventListener = vi.fn();
    removeEventListener = vi.fn();

    createDataChannel = vi.fn(() => {
      const dc = new MockRTCDataChannel();
      this.createdDataChannel = dc;
      return dc;
    });

    createOffer = vi.fn().mockImplementation(async () => {
      const sdp = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:test\r\na=ice-pwd:pwd\r\na=fingerprint:sha-256 AA\r\na=setup:actpass\r\na=mid:0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 192.168.43.1\r\na=sctp-port:5000\r\n";
      return { type: "offer", sdp };
    });

    createAnswer = vi.fn().mockImplementation(async () => {
      const sdp = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:test\r\na=ice-pwd:pwd\r\na=fingerprint:sha-256 BB\r\na=setup:active\r\na=mid:0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 192.168.43.50\r\na=sctp-port:5000\r\n";
      return { type: "answer", sdp };
    });

    setLocalDescription = vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
      this.localDescription = desc;
    });

    setRemoteDescription = vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
      this.remoteDescription = desc;
    });

    addIceCandidate = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();

    constructor(config?: { iceServers?: unknown[] }) {
      this.iceServers = config?.iceServers || [];
      mockPcs.push(this);
    }
  }

  function HookTester() {
    currentHook = useOfflineHotspotRTC();
    return null;
  }

  beforeEach(() => {
    mockPcs.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // @ts-expect-error Mock global RTCPeerConnection
    globalThis.RTCPeerConnection = MockRTCPeerConnection;
    // @ts-expect-error Mock global RTCSessionDescription
    globalThis.RTCSessionDescription = class {
      type: string;
      sdp: string;
      constructor(init: { type: string; sdp: string }) {
        this.type = init.type;
        this.sdp = init.sdp;
      }
    };
    // @ts-expect-error Mock global RTCIceCandidate
    globalThis.RTCIceCandidate = class {
      candidate: string;
      constructor(init: { candidate: string }) {
        this.candidate = init.candidate;
      }
    };
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("initializes with idle state", async () => {
    await act(async () => {
      root.render(React.createElement(HookTester));
    });

    expect(currentHook.isConnected).toBe(false);
    expect(currentHook.progress.status).toBe("idle");
    expect(currentHook.localQrPayload).toBeNull();
    expect(currentHook.error).toBeNull();
    expect(currentHook.pendingHeader).toBeNull();
  });

  it("performs complete optical offer and answer QR handshake round-trip", async () => {
    await act(async () => {
      root.render(React.createElement(HookTester));
    });

    // 1. Sender creates offline offer
    let offerQr = "";
    await act(async () => {
      offerQr = await currentHook.createOfflineOffer();
    });

    expect(offerQr.startsWith("OPTSDP:")).toBe(true);
    expect(currentHook.localQrPayload).toBe(offerQr);

    const senderPc = mockPcs[0];
    expect(senderPc).toBeDefined();
    expect(senderPc.iceServers).toEqual([]); // Zero internet/STUN dependency!
    expect(senderPc.createDataChannel).toHaveBeenCalledWith("hotspot-offline", { ordered: true });

    const decodedOffer = decodeOpticalSdp(offerQr);
    expect(decodedOffer.desc.type).toBe("offer");

    // 2. Receiver accepts offline offer and produces answer QR
    let answerQr = "";
    await act(async () => {
      answerQr = await currentHook.acceptOfflineOffer(offerQr);
    });

    expect(answerQr.startsWith("OPTSDP:")).toBe(true);
    const receiverPc = mockPcs[1];
    expect(receiverPc).toBeDefined();
    expect(receiverPc.iceServers).toEqual([]);
    expect(receiverPc.setRemoteDescription).toHaveBeenCalled();

    const decodedAnswer = decodeOpticalSdp(answerQr);
    expect(decodedAnswer.desc.type).toBe("answer");

    // 3. Sender completes offline answer
    await act(async () => {
      await currentHook.completeOfflineAnswer(answerQr);
    });

    expect(receiverPc.setRemoteDescription).toHaveBeenCalled();
  });

  it("handles incoming transfer header, acceptance, and rejection", async () => {
    await act(async () => {
      root.render(React.createElement(HookTester));
    });

    await act(async () => {
      await currentHook.createOfflineOffer();
    });

    const senderPc = mockPcs[0];
    const dc = senderPc.createdDataChannel!;
    expect(dc).toBeDefined();

    // Trigger onopen
    await act(async () => {
      dc.onopen?.();
    });
    expect(currentHook.isConnected).toBe(true);

    // Receive transfer payload header
    const sampleHeader = {
      type: "file" as const,
      file: { id: "f1", name: "photo.jpg", size: 1024, type: "image/jpeg" },
      totalChunks: 1,
      chunkSize: 1024,
    };

    await act(async () => {
      dc.onmessage?.({ data: JSON.stringify(sampleHeader) });
    });

    expect(currentHook.progress.status).toBe("waiting-acceptance");
    expect(currentHook.progress.fileName).toBe("photo.jpg");
    expect(currentHook.pendingHeader).toEqual(sampleHeader);

    // Accept transfer
    await act(async () => {
      await currentHook.acceptIncomingTransfer();
    });

    expect(dc.send).toHaveBeenCalledWith("ACCEPT");
    expect(currentHook.progress.status).toBe("transferring");

    // Reject transfer scenario
    await act(async () => {
      currentHook.rejectIncomingTransfer();
    });

    expect(dc.send).toHaveBeenCalledWith("REJECT");
    expect(currentHook.progress.status).toBe("rejected");
    expect(currentHook.pendingHeader).toBeNull();
  });

  it("cleans up resources and resets state cleanly", async () => {
    await act(async () => {
      root.render(React.createElement(HookTester));
    });

    await act(async () => {
      await currentHook.createOfflineOffer();
    });

    const senderPc = mockPcs[0];
    const dc = senderPc.createdDataChannel!;

    await act(async () => {
      dc.onopen?.();
      currentHook.cleanup();
    });

    expect(dc.close).toHaveBeenCalled();
    expect(senderPc.close).toHaveBeenCalled();
    expect(currentHook.isConnected).toBe(false);
    expect(currentHook.progress.status).toBe("idle");
    expect(currentHook.localQrPayload).toBeNull();
  });
});
