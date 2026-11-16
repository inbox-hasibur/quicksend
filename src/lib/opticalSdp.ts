interface OpticalSdpPackage {
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
 * Computes a fast, deterministic short hash for payload consistency checking.
 */
export function computeShortHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(6, "0").slice(0, 6);
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
 * Splits a compressed optical SDP string into small, high-scannability sequenced frames.
 * Format: QS1|<index>/<total>|<shortHash>|<chunk>
 */
export function splitOpticalFrames(payload: string, maxCharsPerFrame = 180): string[] {
  const hash = computeShortHash(payload);

  if (payload.length <= maxCharsPerFrame) {
    return [`QS1|1/1|${hash}|${payload}`];
  }

  const total = Math.ceil(payload.length / maxCharsPerFrame);
  const frames: string[] = [];

  for (let i = 0; i < total; i++) {
    const chunk = payload.slice(i * maxCharsPerFrame, (i + 1) * maxCharsPerFrame);
    frames.push(`QS1|${i + 1}/${total}|${hash}|${chunk}`);
  }

  return frames;
}

/**
 * Checks whether a scanned string is a formatted optical frame.
 */
export function isOpticalFrame(payload: string): boolean {
  return typeof payload === "string" && /^QS1\|\d+\/\d+\|[a-f0-9]+\|/.test(payload);
}

/**
 * Checks whether a scanned QR payload is an optical SDP signaling message or frame.
 */
export function isOpticalSdp(payload: string): boolean {
  return (
    typeof payload === "string" &&
    (payload.startsWith("OPTSDP:") || isOpticalFrame(payload))
  );
}

/**
 * Decodes an optical SDP payload back into an RTCSessionDescriptionInit and host candidates.
 */
export function decodeOpticalSdp(
  qrPayload: string
): { desc: RTCSessionDescriptionInit; candidates: RTCIceCandidateInit[] } {
  let cleanPayload = qrPayload;

  // If a single-frame wrapper is passed directly, unwrap it
  if (isOpticalFrame(cleanPayload)) {
    const parts = cleanPayload.split("|");
    if (parts.length >= 4) {
      cleanPayload = parts.slice(3).join("|");
    }
  }

  if (!cleanPayload.startsWith("OPTSDP:")) {
    throw new Error("Invalid optical SDP payload: missing OPTSDP prefix");
  }

  const b64 = cleanPayload.slice(7);
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

export interface FrameCollectorResult {
  complete: boolean;
  progress: { current: number; total: number };
  payload: string | null;
}

/**
 * Incremental optical frame collector for multi-frame QR streams.
 * Accepts scanned frames in any arbitrary order, ignores duplicates,
 * validates hash consistency, and reassembles once all frames are captured.
 */
export class OpticalFrameCollector {
  private currentHash: string | null = null;
  private totalFrames: number = 0;
  private frames: Map<number, string> = new Map();

  reset(): void {
    this.currentHash = null;
    this.totalFrames = 0;
    this.frames.clear();
  }

  getProgress(): { current: number; total: number } {
    return {
      current: this.frames.size,
      total: this.totalFrames,
    };
  }

  addFrame(rawFrame: string): FrameCollectorResult {
    // If a direct raw OPTSDP string was scanned (e.g. from copy-paste)
    if (rawFrame.startsWith("OPTSDP:")) {
      return {
        complete: true,
        progress: { current: 1, total: 1 },
        payload: rawFrame,
      };
    }

    if (!isOpticalFrame(rawFrame)) {
      return {
        complete: false,
        progress: this.getProgress(),
        payload: null,
      };
    }

    const parts = rawFrame.split("|");
    if (parts.length < 4) {
      return {
        complete: false,
        progress: this.getProgress(),
        payload: null,
      };
    }

    const [, ratioStr, frameHash, ...chunkParts] = parts;
    const chunk = chunkParts.join("|");
    const [indexStr, totalStr] = ratioStr.split("/");
    const index = parseInt(indexStr, 10);
    const total = parseInt(totalStr, 10);

    if (isNaN(index) || isNaN(total) || total < 1 || index < 1 || index > total) {
      return {
        complete: false,
        progress: this.getProgress(),
        payload: null,
      };
    }

    // If new hash received from a different batch, reset collector
    if (this.currentHash && this.currentHash !== frameHash) {
      this.reset();
    }

    this.currentHash = frameHash;
    this.totalFrames = total;

    // Ignore duplicate frame index
    if (!this.frames.has(index)) {
      this.frames.set(index, chunk);
    }

    const progress = {
      current: this.frames.size,
      total: this.totalFrames,
    };

    if (this.frames.size === this.totalFrames) {
      // Reassemble in order 1..total
      let reassembled = "";
      for (let i = 1; i <= this.totalFrames; i++) {
        reassembled += this.frames.get(i) || "";
      }

      // Verify reassembled hash matches batch hash
      const reassembledHash = computeShortHash(reassembled);
      if (reassembledHash !== this.currentHash) {
        this.reset();
        return {
          complete: false,
          progress: { current: 0, total: 0 },
          payload: null,
        };
      }

      return {
        complete: true,
        progress: { current: total, total },
        payload: reassembled,
      };
    }

    return {
      complete: false,
      progress,
      payload: null,
    };
  }
}
