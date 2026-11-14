import { describe, it, expect } from "vitest";
import {
  compactSdp,
  encodeOpticalSdp,
  decodeOpticalSdp,
  isOpticalSdp,
  isOpticalFrame,
  splitOpticalFrames,
  computeShortHash,
  OpticalFrameCollector,
} from "@/lib/opticalSdp";

describe("opticalSdp compression and roundtrip encoder", () => {
  const sampleSdp = [
    "v=0",
    "o=- 4123456789 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    "a=ice-ufrag:xyz123",
    "a=ice-pwd:pwd456",
    "a=fingerprint:sha-256 00:11:22:33:44:55",
    "a=setup:actpass",
    "a=mid:0",
    "a=sctp-port:5000",
    "a=max-message-size:262144",
    "a=extraneous-custom-attribute:delete-me",
  ].join("\r\n");

  it("should strip non-essential SDP lines in compactSdp", () => {
    const compacted = compactSdp(sampleSdp);
    expect(compacted).not.toContain("a=extraneous-custom-attribute");
    expect(compacted).toContain("a=ice-ufrag:xyz123");
    expect(compacted).toContain("m=application");
  });

  it("should encode and decode optical SDP offer with host candidates", () => {
    const desc: RTCSessionDescriptionInit = {
      type: "offer",
      sdp: sampleSdp,
    };

    const hostCandidate: RTCIceCandidateInit = {
      candidate: "candidate:1 1 UDP 2130706431 192.168.1.50 5000 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };

    const srflxCandidate: RTCIceCandidateInit = {
      candidate: "candidate:2 1 UDP 1694498815 203.0.113.1 5000 typ srflx",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };

    const encoded = encodeOpticalSdp(desc, [hostCandidate, srflxCandidate]);
    expect(encoded).toMatch(/^OPTSDP:/);
    expect(isOpticalSdp(encoded)).toBe(true);

    const decoded = decodeOpticalSdp(encoded);
    expect(decoded.desc.type).toBe("offer");
    expect(decoded.desc.sdp).toContain("a=ice-ufrag:xyz123");
    // Only host candidate should be preserved in offline optical payload
    expect(decoded.candidates).toHaveLength(1);
    expect(decoded.candidates[0].candidate).toContain("typ host");
  });

  it("should throw error when decoding non-OPTSDP payload", () => {
    expect(() => decodeOpticalSdp("INVALID_STRING")).toThrow(
      "missing OPTSDP prefix"
    );
  });
});

describe("Multi-Frame Sequenced Optical SDP & OpticalFrameCollector", () => {
  const validDesc: RTCSessionDescriptionInit = {
    type: "offer",
    sdp: "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  };
  const validCandidate: RTCIceCandidateInit = {
    candidate: "candidate:1 1 UDP 2130706431 192.168.1.50 5000 typ host",
    sdpMid: "0",
    sdpMLineIndex: 0,
  };
  const dummyPayload = encodeOpticalSdp(validDesc, [validCandidate]);

  it("should compute deterministic short hashes", () => {
    const h1 = computeShortHash("hello world");
    const h2 = computeShortHash("hello world");
    const h3 = computeShortHash("hello quicksend");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toHaveLength(6);
  });

  it("should split payload into small optical frames with index/total headers", () => {
    const frames = splitOpticalFrames(dummyPayload, 50); // 50 chars per frame
    expect(frames.length).toBeGreaterThan(1);

    frames.forEach((frame, idx) => {
      expect(isOpticalFrame(frame)).toBe(true);
      expect(isOpticalSdp(frame)).toBe(true);
      expect(frame).toMatch(new RegExp(`^QS1\\|${idx + 1}\\/${frames.length}\\|`));
    });
  });

  it("should accept raw un-chunked OPTSDP string immediately in collector", () => {
    const collector = new OpticalFrameCollector();
    const result = collector.addFrame(dummyPayload);
    expect(result.complete).toBe(true);
    expect(result.payload).toBe(dummyPayload);
  });

  it("should reassemble sequential multi-frame stream accurately", () => {
    const frames = splitOpticalFrames(dummyPayload, 40);
    const collector = new OpticalFrameCollector();

    for (let i = 0; i < frames.length - 1; i++) {
      const step = collector.addFrame(frames[i]);
      expect(step.complete).toBe(false);
      expect(step.progress.current).toBe(i + 1);
      expect(step.progress.total).toBe(frames.length);
      expect(step.payload).toBeNull();
    }

    const finalStep = collector.addFrame(frames[frames.length - 1]);
    expect(finalStep.complete).toBe(true);
    expect(finalStep.payload).toBe(dummyPayload);

    // Reassembled payload should decode cleanly
    const decoded = decodeOpticalSdp(finalStep.payload!);
    expect(decoded.desc.type).toBe("offer");
    expect(decoded.candidates.length).toBe(1);
  });

  it("should reassemble frames received completely out of order", () => {
    const frames = splitOpticalFrames(dummyPayload, 40);
    const collector = new OpticalFrameCollector();

    // Shuffle frames: e.g. [frames[2], frames[0], frames[3], frames[1]...]
    const shuffled = [...frames].reverse();

    let finalResult: ReturnType<typeof collector.addFrame> | null = null;
    for (const frame of shuffled) {
      finalResult = collector.addFrame(frame);
    }

    expect(finalResult?.complete).toBe(true);
    expect(finalResult?.payload).toBe(dummyPayload);
  });

  it("should ignore duplicate scanned frames gracefully", () => {
    const frames = splitOpticalFrames(dummyPayload, 50);
    const collector = new OpticalFrameCollector();

    // Scan frame 1 twice
    collector.addFrame(frames[0]);
    const duplicateStep = collector.addFrame(frames[0]);
    expect(duplicateStep.progress.current).toBe(1);

    // Complete the rest
    for (let i = 1; i < frames.length; i++) {
      collector.addFrame(frames[i]);
    }

    expect(collector.getProgress().current).toBe(frames.length);
  });

  it("should reset and validate hash when a frame from a new batch arrives", () => {
    const payloadA = "OPTSDP:Payload_Alpha_Data_1234567890_First_Batch_Here";
    const payloadB = "OPTSDP:Payload_Beta_Data_9876543210_Second_Batch_Here";

    const framesA = splitOpticalFrames(payloadA, 20);
    const framesB = splitOpticalFrames(payloadB, 20);

    const collector = new OpticalFrameCollector();

    // Scan 1 frame from batch A
    collector.addFrame(framesA[0]);
    expect(collector.getProgress().current).toBe(1);

    // User restarts with batch B: scan frame from batch B -> resets collector to batch B
    collector.addFrame(framesB[0]);
    expect(collector.getProgress().current).toBe(1);

    // Complete batch B
    let result: ReturnType<typeof collector.addFrame> | null = null;
    for (let i = 1; i < framesB.length; i++) {
      result = collector.addFrame(framesB[i]);
    }

    expect(result?.complete).toBe(true);
    expect(result?.payload).toBe(payloadB);
  });
});
