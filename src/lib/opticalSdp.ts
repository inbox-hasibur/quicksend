interface OpticalSdpPackage {
  type: "offer" | "answer";
  sdp: string;
  candidates?: RTCIceCandidateInit[];
}

/**
 * 32-character unambiguous uppercase alphabet excluding 0, 1, O, I.
 */
export const BASE32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const B32_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE32_ALPHABET.length; i++) {
  B32_LOOKUP[BASE32_ALPHABET[i]] = i;
}

/**
 * Strips all spaces, hyphens, and non-alphabet characters, returning clean uppercase alphanumeric characters.
 */
export function stripHandshakeFormatting(input: string): string {
  if (!input) return "";
  return input.toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "");
}

/**
 * Formats a raw handshake code into clean 4-character hyphenated blocks:
 * e.g. "Q4AB - CDEF - GHJK - ..."
 */
export function formatHandshakeCode(raw: string): string {
  if (!raw) return "";
  const clean = stripHandshakeFormatting(raw);
  if (!clean) return "";

  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return chunks.join(" - ");
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(str: string): Uint8Array {
  const clean = stripHandshakeFormatting(str);
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const val = B32_LOOKUP[clean[i]];
    if (val === undefined) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

export function computeByteChecksum(bytes: Uint8Array, length: number): number {
  let sum = 0x5a;
  for (let i = 0; i < length; i++) {
    sum = (sum * 31 + bytes[i]) & 0xff;
  }
  return sum;
}

/**
 * Strips non-essential SDP attributes to maximize QR scannability.
 */
export function compactSdp(sdp: string): string {
  return sdp
    .split(/\r?\n/)
    .filter((line) => {
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

function packSdpToBytes(
  type: "offer" | "answer",
  ufrag: string,
  pwd: string,
  fpHex64: string,
  cands: ParsedCandidate[]
): Uint8Array {
  const textEncoder = new TextEncoder();
  const ufragBytes = textEncoder.encode(ufrag);
  const pwdBytes = textEncoder.encode(pwd);

  // Convert 64 hex characters to 32 binary bytes
  const fpBytes = new Uint8Array(32);
  const cleanFp = fpHex64.replace(/[^0-9a-fA-F]/g, "").padStart(64, "0").slice(0, 64);
  for (let i = 0; i < 32; i++) {
    fpBytes[i] = parseInt(cleanFp.slice(i * 2, i * 2 + 2), 16);
  }

  // Use up to 2 best host candidates
  const topCands = cands.slice(0, 2);

  // Calculate buffer size
  let candBytesLen = 0;
  for (const c of topCands) {
    const isIpv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(c.ip);
    if (isIpv4) {
      candBytesLen += 7; // 1 type + 4 ip + 2 port
    } else {
      const hostBytes = textEncoder.encode(c.ip);
      candBytesLen += 4 + hostBytes.length; // 1 type + 2 port + 1 len + hostLen
    }
  }

  const totalLen =
    1 + // header
    1 + ufragBytes.length + // ufrag len + bytes
    1 + pwdBytes.length + // pwd len + bytes
    32 + // fingerprint
    candBytesLen + // candidates
    1; // checksum

  const buf = new Uint8Array(totalLen);
  let pos = 0;

  // Header byte: bit 7 = isAnswer, bit 6-5 = version (0), bit 4-0 = candCount
  const isAnswer = type === "answer";
  buf[pos++] = (isAnswer ? 0x80 : 0x00) | (topCands.length & 0x1f);

  // ufrag
  buf[pos++] = ufragBytes.length;
  buf.set(ufragBytes, pos);
  pos += ufragBytes.length;

  // pwd
  buf[pos++] = pwdBytes.length;
  buf.set(pwdBytes, pos);
  pos += pwdBytes.length;

  // fingerprint (32 bytes)
  buf.set(fpBytes, pos);
  pos += 32;

  // Candidates
  for (const c of topCands) {
    const isIpv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(c.ip);
    if (isIpv4) {
      buf[pos++] = c.proto === "tcp" ? 0x02 : 0x01; // 1 = IPv4 UDP, 2 = IPv4 TCP
      const octets = c.ip.split(".").map(Number);
      buf[pos++] = octets[0];
      buf[pos++] = octets[1];
      buf[pos++] = octets[2];
      buf[pos++] = octets[3];
      buf[pos++] = (c.port >> 8) & 0xff;
      buf[pos++] = c.port & 0xff;
    } else {
      const hostBytes = textEncoder.encode(c.ip);
      buf[pos++] = c.proto === "tcp" ? 0x04 : 0x03; // 3 = Host UDP, 4 = Host TCP
      buf[pos++] = (c.port >> 8) & 0xff;
      buf[pos++] = c.port & 0xff;
      buf[pos++] = hostBytes.length;
      buf.set(hostBytes, pos);
      pos += hostBytes.length;
    }
  }

  // Trailing 1-byte checksum
  const checksum = computeByteChecksum(buf, pos);
  buf[pos++] = checksum;

  return buf;
}

function unpackBytesToSdp(bytes: Uint8Array): {
  desc: RTCSessionDescriptionInit;
  candidates: RTCIceCandidateInit[];
} {
  const textDecoder = new TextDecoder();
  let pos = 0;

  if (bytes.length < 36) {
    throw new Error("Code has a typo — please double-check");
  }

  const header = bytes[pos++];
  const isAnswer = (header & 0x80) !== 0;
  const type: "offer" | "answer" = isAnswer ? "answer" : "offer";
  const candCount = header & 0x1f;

  const ufragLen = bytes[pos++];
  if (pos + ufragLen > bytes.length) throw new Error("Code has a typo — please double-check");
  const ufrag = textDecoder.decode(bytes.slice(pos, pos + ufragLen));
  pos += ufragLen;

  const pwdLen = bytes[pos++];
  if (pos + pwdLen > bytes.length) throw new Error("Code has a typo — please double-check");
  const pwd = textDecoder.decode(bytes.slice(pos, pos + pwdLen));
  pos += pwdLen;

  if (pos + 32 > bytes.length) throw new Error("Code has a typo — please double-check");
  const fpBytes = bytes.slice(pos, pos + 32);
  pos += 32;

  let fpHex = "";
  for (let i = 0; i < 32; i++) {
    fpHex += fpBytes[i].toString(16).padStart(2, "0").toUpperCase();
  }
  const colonFp = fpHex.match(/.{1,2}/g)?.join(":") || fpHex;

  const candidateObjects: RTCIceCandidateInit[] = [];
  for (let i = 0; i < candCount; i++) {
    if (pos >= bytes.length) throw new Error("Code has a typo — please double-check");
    const candType = bytes[pos++];
    if (candType === 1 || candType === 2) {
      if (pos + 6 > bytes.length) throw new Error("Code has a typo — please double-check");
      const ip = `${bytes[pos]}.${bytes[pos + 1]}.${bytes[pos + 2]}.${bytes[pos + 3]}`;
      pos += 4;
      const port = (bytes[pos] << 8) | bytes[pos + 1];
      pos += 2;
      const proto = candType === 2 ? "TCP" : "UDP";
      const prio = 2130706431 - i;
      candidateObjects.push({
        candidate: `candidate:${i + 1} 1 ${proto} ${prio} ${ip} ${port} typ host generation 0`,
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
    } else if (candType === 3 || candType === 4) {
      if (pos + 3 > bytes.length) throw new Error("Code has a typo — please double-check");
      const port = (bytes[pos] << 8) | bytes[pos + 1];
      pos += 2;
      const hostLen = bytes[pos++];
      if (pos + hostLen > bytes.length) throw new Error("Code has a typo — please double-check");
      const ip = textDecoder.decode(bytes.slice(pos, pos + hostLen));
      pos += hostLen;
      const proto = candType === 4 ? "TCP" : "UDP";
      const prio = 2130706431 - i;
      candidateObjects.push({
        candidate: `candidate:${i + 1} 1 ${proto} ${prio} ${ip} ${port} typ host generation 0`,
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
    }
  }

  if (pos >= bytes.length) {
    throw new Error("Code has a typo — please double-check");
  }

  const expectedChecksum = bytes[pos];
  const calculatedChecksum = computeByteChecksum(bytes, pos);
  if (expectedChecksum !== calculatedChecksum) {
    throw new Error("Code has a typo — please double-check");
  }

  // Strict RFC 4566 / JSEP standard order
  const sdpLines: string[] = [
    "v=0",
    "o=- 1234567890 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    "a=ice-options:trickle",
    `a=fingerprint:sha-256 ${colonFp}`,
    `a=setup:${type === "answer" ? "active" : "actpass"}`,
    "a=mid:0",
    "a=sctp-port:5000",
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

/**
 * Encodes an RTCSessionDescription and optional host ICE candidates into an ultra-compact binary Base32 Q4 string.
 * Format: Q4<Base32(rawBytes)> with trailing 1-byte checksum.
 * ~110-135 alphanumeric characters total, case-insensitive, zero colons/pipes.
 */
export function encodeOpticalSdp(
  desc: RTCSessionDescriptionInit,
  candidates: RTCIceCandidateInit[] = []
): string {
  const type = desc.type === "answer" ? "answer" : "offer";
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

  // Collect host candidates
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

  const packedBytes = packSdpToBytes(type, ufrag, pwd, fpHex64, uniqueCands);
  const b32 = base32Encode(packedBytes);
  return `Q4${b32}`;
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
  if (typeof payload !== "string") return false;
  const clean = stripHandshakeFormatting(payload);
  return (
    clean.startsWith("Q4") ||
    payload.startsWith("QS3:") ||
    payload.startsWith("OPTSDP:") ||
    isOpticalFrame(payload)
  );
}

/**
 * Decodes an optical SDP payload back into an RTCSessionDescriptionInit and host candidates.
 * Supports compact Q4 Base32, QS3 format, and legacy OPTSDP base64 format.
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

  // 1. Check for Q4 compact binary Base32 format (case-insensitive, formatting stripped)
  const stripped = stripHandshakeFormatting(cleanPayload);
  if (stripped.startsWith("Q4")) {
    const b32 = stripped.slice(2);
    const bytes = base32Decode(b32);
    return unpackBytesToSdp(bytes);
  }

  // 2. Check for QS3 pipe-delimited format (backwards compatibility)
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

  // 3. Check for OPTSDP base64 format (backwards compatibility)
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

  throw new Error("Invalid optical SDP payload: unrecognized code format");
}

export interface FrameCollectorResult {
  complete: boolean;
  progress: { current: number; total: number };
  payload: string | null;
}

/**
 * Incremental optical frame collector for multi-frame QR streams.
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
    // If a direct raw string was scanned or typed
    const stripped = stripHandshakeFormatting(rawFrame);
    if (stripped.startsWith("Q4") || rawFrame.startsWith("QS3:") || rawFrame.startsWith("OPTSDP:")) {
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
      let reassembled = "";
      for (let i = 1; i <= this.totalFrames; i++) {
        reassembled += this.frames.get(i) || "";
      }

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
