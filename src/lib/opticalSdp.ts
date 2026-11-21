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
    .split(/\r?\n/)
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

interface ParsedCandidate {
  ip: string;
  port: number;
  proto: string;
}

function parseHostCandidate(raw: string): ParsedCandidate | null {
  const str = raw.replace(/^a=/, "").trim();
  const match = str.match(/candidate:\S+\s+\d+\s+(\w+)\s+\S+\s+(\S+)\s+(\d+)\s+typ\s+host/i);
  if (!match) return null;
  const proto = match[1].toLowerCase();
  const ip = match[2];
  const port = parseInt(match[3], 10);
  if (isNaN(port) || port <= 0 || port > 65535) return null;
  return { ip, port, proto };
}

function getCandidatePriority(ip: string): number {
  if (/^192\.168\./.test(ip)) return 0;
  if (/^10\./.test(ip)) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return 2;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return 3;
  if (ip.endsWith(".local")) return 4;
  if (ip.includes(":")) return 5;
  return 6;
}

/**
 * Encodes an RTCSessionDescription and optional host ICE candidates into a compact QS3 string.
 * Format: QS3:<type>|<ufrag>|<pwd>|<fpHex64>|<setup>|<mid>|<sctpPort>|<cands>
 * Typically ~170-240 characters total for single-static QR scanning.
 */
export function encodeOpticalSdp(
  desc: RTCSessionDescriptionInit,
  candidates: RTCIceCandidateInit[] = []
): string {
  const typeChar = desc.type === "answer" ? "a" : "o";
  const sdp = desc.sdp || "";
  const lines = sdp.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const ufragLine = lines.find((l) => l.startsWith("a=ice-ufrag:"));
  const ufrag = ufragLine ? ufragLine.slice("a=ice-ufrag:".length).trim() : "";

  const pwdLine = lines.find((l) => l.startsWith("a=ice-pwd:"));
  const pwd = pwdLine ? pwdLine.slice("a=ice-pwd:".length).trim() : "";

  const fpLine = lines.find((l) => l.startsWith("a=fingerprint:"));
  let fpHex64 = "";
  if (fpLine) {
    fpHex64 = fpLine
      .replace(/^a=fingerprint:\S+\s+/, "")
      .replace(/[^0-9a-fA-F]/g, "")
      .toUpperCase();
  }

  const setupLine = lines.find((l) => l.startsWith("a=setup:"));
  const setup = setupLine
    ? setupLine.slice("a=setup:".length).trim()
    : desc.type === "answer"
    ? "active"
    : "actpass";

  const midLine = lines.find((l) => l.startsWith("a=mid:"));
  const mid = midLine ? midLine.slice("a=mid:".length).trim() : "0";

  const sctpLine = lines.find(
    (l) => l.startsWith("a=sctp-port:") || l.startsWith("a=sctpmap:")
  );
  let sctpPort = "5000";
  if (sctpLine) {
    const match = sctpLine.match(/(?:a=sctp-port:|a=sctpmap:)(\d+)/);
    if (match) sctpPort = match[1];
  }

  // Collect host candidates from both candidates parameter and desc.sdp
  const candidatePool: ParsedCandidate[] = [];

  for (const c of candidates) {
    if (c.candidate) {
      const parsed = parseHostCandidate(c.candidate);
      if (parsed) candidatePool.push(parsed);
    }
  }

  for (const l of lines) {
    if (l.startsWith("a=candidate:")) {
      const parsed = parseHostCandidate(l);
      if (parsed) candidatePool.push(parsed);
    }
  }

  // Deduplicate and prioritize host candidates (LAN private IPv4 first)
  const seen = new Set<string>();
  const uniqueCands: ParsedCandidate[] = [];
  for (const cand of candidatePool) {
    const key = `${cand.ip}:${cand.port}:${cand.proto}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCands.push(cand);
    }
  }

  uniqueCands.sort(
    (a, b) => getCandidatePriority(a.ip) - getCandidatePriority(b.ip)
  );

  const topCands = uniqueCands.slice(0, 4);
  const candsStr = topCands
    .map((c) => `${c.ip},${c.port},${c.proto}`)
    .join(";");

  return `QS3:${typeChar}|${ufrag}|${pwd}|${fpHex64}|${setup}|${mid}|${sctpPort}|${candsStr}`;
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
    (payload.startsWith("QS3:") ||
      payload.startsWith("OPTSDP:") ||
      isOpticalFrame(payload))
  );
}

/**
 * Decodes an optical SDP payload back into an RTCSessionDescriptionInit and host candidates.
 * Supports compact QS3 format and legacy OPTSDP base64 format.
 */
export function decodeOpticalSdp(
  qrPayload: string
): { desc: RTCSessionDescriptionInit; candidates: RTCIceCandidateInit[] } {
  let cleanPayload = qrPayload.trim();

  // If a single-frame wrapper is passed directly, unwrap it
  if (isOpticalFrame(cleanPayload)) {
    const parts = cleanPayload.split("|");
    if (parts.length >= 4) {
      cleanPayload = parts.slice(3).join("|");
    }
  }

  if (cleanPayload.startsWith("QS3:")) {
    const body = cleanPayload.slice(4);
    const [typeChar, ufrag, pwd, fpHex64, setupVal, midVal, sctpPortVal, candsStr] =
      body.split("|");

    const type: "offer" | "answer" = typeChar === "a" ? "answer" : "offer";
    const mid = midVal || "0";
    const sctpPort = sctpPortVal || "5000";
    const setup = setupVal || (type === "answer" ? "active" : "actpass");
    const colonFp =
      (fpHex64 || "")
        .match(/.{1,2}/g)
        ?.join(":")
        .toUpperCase() || fpHex64;

    const candidateObjects: RTCIceCandidateInit[] = [];
    if (candsStr) {
      const candEntries = candsStr.split(/[;/]/).map((s) => s.trim()).filter(Boolean);
      candEntries.forEach((entry, idx) => {
        const [ip, portStr, protoStr] = entry.split(",");
        const port = parseInt(portStr, 10) || 5000;
        const proto = (protoStr || "udp").toUpperCase();
        const prio = 2130706431 - idx;
        const candStr = `candidate:${idx + 1} 1 ${proto} ${prio} ${ip} ${port} typ host generation 0`;
        candidateObjects.push({
          candidate: candStr,
          sdpMid: mid,
          sdpMLineIndex: 0,
        });
      });
    }

    // Strict RFC 4566 / JSEP standard order:
    // Session description lines first, then media description (m=application), then media attributes
    const sdpLines: string[] = [
      "v=0",
      "o=- 1234567890 2 IN IP4 127.0.0.1",
      "s=-",
      "t=0 0",
      `a=group:BUNDLE ${mid}`,
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
      "c=IN IP4 0.0.0.0",
      `a=ice-ufrag:${ufrag || ""}`,
      `a=ice-pwd:${pwd || ""}`,
      "a=ice-options:trickle",
      `a=fingerprint:sha-256 ${colonFp}`,
      `a=setup:${setup}`,
      `a=mid:${mid}`,
      `a=sctp-port:${sctpPort}`,
      "a=max-message-size:262144",
    ];

    for (const c of candidateObjects) {
      sdpLines.push(`a=${c.candidate}`);
    }
    sdpLines.push("a=end-of-candidates");

    const sdp = sdpLines.join("\r\n") + "\r\n";

    return {
      desc: {
        type,
        sdp,
      },
      candidates: candidateObjects,
    };
  }

  if (cleanPayload.startsWith("OPTSDP:")) {
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

  throw new Error("Invalid optical SDP payload: missing QS3 or OPTSDP prefix");
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
    // If a direct raw string was scanned (e.g. from copy-paste or single-QR scan)
    if (rawFrame.startsWith("QS3:") || rawFrame.startsWith("OPTSDP:")) {
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
