export interface OpticalSdpPackage {
  type: "offer" | "answer";
  sdp: string;
  candidates?: RTCIceCandidateInit[];
}

/**
 * Strips non-essential SDP attributes (e.g. extraneous codecs) to maximize QR scannability.
 */
export function compactSdp(sdp: string): string {
  return sdp
    .split("\r\n")
    .filter((line) => {
      // Keep only vital WebRTC connection lines
      return (
        line.startsWith("v=") ||
        line.startsWith("o=") ||
        line.startsWith("s=") ||
        line.startsWith("t=") ||
        line.startsWith("a=group:") ||
        line.startsWith("m=application") ||
        line.startsWith("c=") ||
        line.startsWith("a=ice-") ||
        line.startsWith("a=fingerprint:") ||
        line.startsWith("a=setup:") ||
        line.startsWith("a=mid:") ||
        line.startsWith("a=sctp-port:") ||
        line.startsWith("a=max-message-size:")
      );
    })
    .join("\r\n");
}

/**
 * Encodes an RTCSessionDescription and optional host ICE candidates into a compact string for QR rendering.
 */
export function encodeOpticalSdp(
  desc: RTCSessionDescriptionInit,
  candidates: RTCIceCandidateInit[] = []
): string {
  const compacted = desc.sdp ? compactSdp(desc.sdp) : "";
  const pkg: OpticalSdpPackage = {
    type: desc.type as "offer" | "answer",
    sdp: compacted,
    candidates: candidates.filter((c) => c.candidate && c.candidate.includes("typ host")),
  };

  const jsonStr = JSON.stringify(pkg);
  // Base64 encode for clean QR character set
  if (typeof btoa !== "undefined") {
    return `OPTSDP:${btoa(unescape(encodeURIComponent(jsonStr)))}`;
  }
  return `OPTSDP:${Buffer.from(jsonStr, "utf-8").toString("base64")}`;
}

/**
 * Decodes an optical SDP QR payload back into an RTCSessionDescriptionInit and candidates.
 */
export function decodeOpticalSdp(
  qrPayload: string
): { desc: RTCSessionDescriptionInit; candidates: RTCIceCandidateInit[] } {
  if (!qrPayload.startsWith("OPTSDP:")) {
    throw new Error("Invalid optical SDP payload: missing OPTSDP prefix");
  }

  const b64 = qrPayload.slice(7);
  let jsonStr = "";
  if (typeof atob !== "undefined") {
    jsonStr = decodeURIComponent(escape(atob(b64)));
  } else {
    jsonStr = Buffer.from(b64, "base64").toString("utf-8");
  }

  const pkg: OpticalSdpPackage = JSON.parse(jsonStr);
  return {
    desc: {
      type: pkg.type,
      sdp: pkg.sdp,
    },
    candidates: pkg.candidates || [],
  };
}

/**
 * Checks whether a scanned QR payload is an optical SDP signaling message.
 */
export function isOpticalSdp(payload: string): boolean {
  return typeof payload === "string" && payload.startsWith("OPTSDP:");
}
