import { describe, it, expect } from "vitest";
import {
  compactSdp,
  encodeOpticalSdp,
  decodeOpticalSdp,
  isOpticalSdp,
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
