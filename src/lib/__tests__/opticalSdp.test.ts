import { describe, it, expect } from "vitest";
import {
  compactSdp,
  encodeOpticalSdp,
  decodeOpticalSdp,
  isOpticalSdp,
  isOpticalFrame,
  splitOpticalFrames,
  computeShortHash,
  formatHandshakeCode,
  stripHandshakeFormatting,
  BASE32_ALPHABET,
  OpticalFrameCollector,
} from "@/lib/opticalSdp";

describe("opticalSdp Q4 compact binary Base32 codec and roundtrip encoder", () => {
  const sampleChromiumSdp = [
    "v=0",
    "o=- 7183920194820192831 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=extmap-allow-mixed",
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    "a=ice-ufrag:xyz123",
    "a=ice-pwd:pwd456",
    "a=ice-options:trickle",
    "a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF",
    "a=setup:actpass",
    "a=mid:0",
    "a=sctp-port:5000",
    "a=max-message-size:262144",
    "a=extraneous-custom-attribute:delete-me",
  ].join("\r\n");

  it("should strip non-essential SDP lines in compactSdp", () => {
    const compacted = compactSdp(sampleChromiumSdp);
    expect(compacted).not.toContain("a=extraneous-custom-attribute");
    expect(compacted).toContain("a=ice-ufrag:xyz123");
    expect(compacted).toContain("m=application");
  });

  it("should encode real Chromium DataChannel SDP to compact Q4 under 150 characters with zero colons or pipes", () => {
    const desc: RTCSessionDescriptionInit = {
      type: "offer",
      sdp: sampleChromiumSdp,
    };

    const hostCandidateLan: RTCIceCandidateInit = {
      candidate: "candidate:1 1 UDP 2130706431 192.168.1.50 5000 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };

    const hostCandidateLocal: RTCIceCandidateInit = {
      candidate: "candidate:2 1 UDP 2130706430 phone.local 5001 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };

    const srflxCandidate: RTCIceCandidateInit = {
      candidate: "candidate:3 1 UDP 1694498815 203.0.113.1 5000 typ srflx",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };

    const encoded = encodeOpticalSdp(desc, [
      hostCandidateLan,
      hostCandidateLocal,
      srflxCandidate,
    ]);

    // Format verification: starts with Q4 prefix
    expect(encoded).toMatch(/^Q4/);
    expect(isOpticalSdp(encoded)).toBe(true);

    // Purely alphanumeric: ZERO colons, pipes, or commas!
    expect(encoded).not.toMatch(/[:|,\s]/);

    // Highly compact size (< 150 characters, ideal for single static QR code and typing)
    expect(encoded.length).toBeLessThan(150);
  });

  it("should decode Q4 to valid RFC 4566 SDP placing m=application strictly BEFORE a=max-message-size", () => {
    const desc: RTCSessionDescriptionInit = {
      type: "offer",
      sdp: sampleChromiumSdp,
    };

    const hostCandidate: RTCIceCandidateInit = {
      candidate: "candidate:1 1 UDP 2130706431 192.168.1.50 5000 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };

    const encoded = encodeOpticalSdp(desc, [hostCandidate]);
    const decoded = decodeOpticalSdp(encoded);

    expect(decoded.desc.type).toBe("offer");
    const sdp = decoded.desc.sdp!;

    // Must use strict CRLF line endings
    expect(sdp).toContain("\r\n");
    expect(sdp.endsWith("\r\n")).toBe(true);

    // Strictly verify section order: session lines FIRST
    expect(sdp.indexOf("v=0")).toBe(0);
    const sessEndPos = sdp.indexOf("a=group:BUNDLE 0");
    const mAppPos = sdp.indexOf("m=application 9 UDP/DTLS/SCTP webrtc-datachannel");
    const maxMsgPos = sdp.indexOf("a=max-message-size:262144");

    expect(sessEndPos).toBeGreaterThan(-1);
    expect(mAppPos).toBeGreaterThan(sessEndPos);

    // CRITICAL: m=application must be strictly BEFORE a=max-message-size:262144
    // (Chromium throws "Invalid SDP line" if a=max-message-size is in session section)
    expect(maxMsgPos).toBeGreaterThan(mAppPos);

    // Preserved critical connection parameters
    expect(sdp).toContain("a=ice-ufrag:xyz123");
    expect(sdp).toContain("a=ice-pwd:pwd456");
    expect(sdp).toContain(
      "a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF"
    );
    expect(sdp).toContain("a=setup:actpass");
    expect(sdp).toContain("a=mid:0");
    expect(sdp).toContain("a=sctp-port:5000");

    // Preserved host candidates
    expect(decoded.candidates).toHaveLength(1);
    expect(decoded.candidates[0].candidate).toContain("192.168.1.50 5000 typ host");
    expect(sdp).toContain("192.168.1.50");
    expect(sdp).toContain("a=end-of-candidates");
  });

  it("should prioritize private LAN IPv4 candidates first and limit to 2", () => {
    const desc: RTCSessionDescriptionInit = {
      type: "offer",
      sdp: sampleChromiumSdp,
    };

    const candidates: RTCIceCandidateInit[] = [
      { candidate: "candidate:1 1 UDP 2130706431 2001:db8::1 5000 typ host" },
      { candidate: "candidate:2 1 UDP 2130706431 dev.local 5000 typ host" },
      { candidate: "candidate:3 1 UDP 2130706431 10.0.0.5 5000 typ host" },
      { candidate: "candidate:4 1 UDP 2130706431 192.168.1.50 5000 typ host" },
      { candidate: "candidate:5 1 UDP 2130706431 172.20.1.1 5000 typ host" },
    ];

    const encoded = encodeOpticalSdp(desc, candidates);
    const decoded = decodeOpticalSdp(encoded);

    // Highest priority private IPv4 candidates must be placed first, limited to 2
    expect(decoded.candidates.length).toBe(2);
    expect(decoded.candidates[0].candidate).toContain("192.168.1.50");
    expect(decoded.candidates[1].candidate).toContain("10.0.0.5");
  });

  it("should encode and decode answer descriptions correctly", () => {
    const answerSdp = sampleChromiumSdp
      .replace("a=setup:actpass", "a=setup:active")
      .replace("a=ice-ufrag:xyz123", "a=ice-ufrag:answerUfrag")
      .replace("a=ice-pwd:pwd456", "a=ice-pwd:answerPwd");

    const desc: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: answerSdp,
    };

    const encoded = encodeOpticalSdp(desc);
    expect(encoded).toMatch(/^Q4/);

    const decoded = decodeOpticalSdp(encoded);
    expect(decoded.desc.type).toBe("answer");
    expect(decoded.desc.sdp).toContain("a=setup:active");
    expect(decoded.desc.sdp).toContain("a=ice-ufrag:answerUfrag");
    expect(decoded.desc.sdp).toContain("a=ice-pwd:answerPwd");
  });

  it("should detect single-character typos and throw clear error", () => {
    const desc: RTCSessionDescriptionInit = {
      type: "offer",
      sdp: sampleChromiumSdp,
    };
    const encoded = encodeOpticalSdp(desc);

    // Tamper with one character in the middle
    const tamperedChar = encoded[15] === "2" ? "3" : "2";
    const tampered = encoded.slice(0, 15) + tamperedChar + encoded.slice(16);

    expect(() => decodeOpticalSdp(tampered)).toThrow("Code has a typo — please double-check");
  });

  it("should support case-insensitive decoding and ignore hyphens and spaces", () => {
    const desc: RTCSessionDescriptionInit = {
      type: "offer",
      sdp: sampleChromiumSdp,
    };
    const encoded = encodeOpticalSdp(desc);
    const formatted = formatHandshakeCode(encoded);

    expect(formatted).toContain(" - ");

    // Decode lowercase formatted string
    const decoded = decodeOpticalSdp(formatted.toLowerCase());
    expect(decoded.desc.type).toBe("offer");
    expect(decoded.desc.sdp).toContain("a=ice-ufrag:xyz123");
  });

  it("should format and strip handshake codes correctly", () => {
    expect(formatHandshakeCode("Q4ABCDEFGHJK")).toBe("Q4AB - CDEF - GHJK");
    expect(stripHandshakeFormatting("q4ab - cdef - ghjk!")).toBe("Q4ABCDEFGHJK");

    // Strips ambiguous characters 0, 1, O, I
    expect(stripHandshakeFormatting("Q401OIZ")).toBe("Q4Z");
    expect(BASE32_ALPHABET).not.toContain("0");
    expect(BASE32_ALPHABET).not.toContain("1");
    expect(BASE32_ALPHABET).not.toContain("O");
    expect(BASE32_ALPHABET).not.toContain("I");
    expect(BASE32_ALPHABET.length).toBe(32);
  });

  it("should preserve backward compatibility with QS3 pipe-delimited format", () => {
    const qs3Payload =
      "QS3:o|testufrag|testpwd|00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF|actpass|0|5000|192.168.1.50,5000,udp";

    expect(isOpticalSdp(qs3Payload)).toBe(true);

    const decoded = decodeOpticalSdp(qs3Payload);
    expect(decoded.desc.type).toBe("offer");
    expect(decoded.desc.sdp).toContain("a=ice-ufrag:testufrag");
    expect(decoded.desc.sdp).toContain("a=ice-pwd:testpwd");
    expect(decoded.candidates).toHaveLength(1);
    expect(decoded.candidates[0].candidate).toContain("192.168.1.50 5000 typ host");
  });

  it("should preserve backward compatibility with legacy OPTSDP base64 payloads", () => {
    const legacyPkg = {
      type: "offer",
      sdp: sampleChromiumSdp,
      candidates: [
        {
          candidate: "candidate:1 1 UDP 2130706431 192.168.1.50 5000 typ host",
          sdpMid: "0",
          sdpMLineIndex: 0,
        },
      ],
    };

    const b64 = Buffer.from(JSON.stringify(legacyPkg), "utf-8").toString("base64");
    const legacyPayload = `OPTSDP:${b64}`;

    expect(isOpticalSdp(legacyPayload)).toBe(true);

    const decoded = decodeOpticalSdp(legacyPayload);
    expect(decoded.desc.type).toBe("offer");
    expect(decoded.desc.sdp).toContain("a=ice-ufrag:xyz123");
    expect(decoded.candidates).toHaveLength(1);
    expect(decoded.candidates[0].candidate).toContain("192.168.1.50");
  });

  it("should throw error when decoding unrecognized payload", () => {
    expect(() => decodeOpticalSdp("INVALID_STRING")).toThrow(
      "Invalid optical SDP payload: unrecognized code format"
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
    const frames = splitOpticalFrames(dummyPayload, 20); // 20 chars per frame
    expect(frames.length).toBeGreaterThan(1);

    frames.forEach((frame, idx) => {
      expect(isOpticalFrame(frame)).toBe(true);
      expect(isOpticalSdp(frame)).toBe(true);
      expect(frame).toMatch(new RegExp(`^QS1\\|${idx + 1}\\/${frames.length}\\|`));
    });
  });

  it("should accept raw un-chunked Q4 string immediately in collector", () => {
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

    // Shuffle frames
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
    const payloadA = "QS3:o|ufragA|pwdA|00112233|actpass|0|5000|192.168.1.1,5000,udp";
    const payloadB = "QS3:o|ufragB|pwdB|44556677|actpass|0|5000|192.168.1.2,5000,udp";

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
