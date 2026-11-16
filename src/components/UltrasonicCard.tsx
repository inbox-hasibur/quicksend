"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Volume2,
  Mic,
  Radio,
  Play,
  Square,
  Copy,
  Check,
  Download,
  AlertCircle,
  Sparkles,
  Zap,
  FileText,
} from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { formatBytes } from "@/lib/chunker";
import { addTransferHistoryItem } from "@/hooks/useTransferHistory";
import {
  encodePayloadToAcousticNibbles,
  decodeAcousticNibblesToPayload,
  nibbleToFrequency,
  frequencyToNibble,
  classifyTone,
  ULTRASONIC_PRESETS,
  type UltrasonicConfig,
  type AcousticPayload,
} from "@/lib/ultrasonicStream";

type AcousticRole = "send" | "receive";
type AcousticPreset = "nearUltrasonic" | "audibleChirp";

export function UltrasonicCard() {
  const [role, setRole] = useState<AcousticRole>("send");
  const [preset, setPreset] = useState<AcousticPreset>("nearUltrasonic");

  // Payload state for left partition
  const [selectedPayload, setSelectedPayload] = useState<{ files: File[]; text: string }>({
    files: [],
    text: "PIN: 749281",
  });

  // Transmitter state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{
    current: number;
    total: number;
    currentFreq?: number;
  } | null>(null);

  // Receiver state
  const [isListening, setIsListening] = useState(false);
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [receivedPayload, setReceivedPayload] = useState<AcousticPayload | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [receiveSymbolsCount, setReceiveSymbolsCount] = useState(0);

  // Web Audio Context & node refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscNodeRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeConfig: UltrasonicConfig = ULTRASONIC_PRESETS[preset];

  // Initialize or resume AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // TRANSMIT / BROADCAST VIA SPEAKER
  const startBroadcasting = useCallback(async () => {
    const hasFiles = selectedPayload.files.length > 0;
    const hasText = selectedPayload.text.trim().length > 0;
    if (!hasFiles && !hasText) return;

    try {
      const ctx = getAudioContext();
      setIsBroadcasting(true);
      setBroadcastProgress(null);

      const encoded = await encodePayloadToAcousticNibbles({
        file: hasFiles ? selectedPayload.files[0] : undefined,
        text: !hasFiles ? selectedPayload.text.trim() : undefined,
      });

      const nibbles = encoded.nibbles;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      oscNodeRef.current = osc;
      gainNodeRef.current = gain;

      let time = ctx.currentTime + 0.1;
      const symbolTime = activeConfig.symbolDurationMs / 1000;
      const rampTime = 0.008; // 8ms anti-pop ramp

      // 1. Play Start / Preamble Tone (160ms)
      osc.frequency.setValueAtTime(activeConfig.startFreq, time);
      gain.gain.linearRampToValueAtTime(0.5, time + rampTime);
      gain.gain.linearRampToValueAtTime(0.5, time + 0.16 - rampTime);
      gain.gain.linearRampToValueAtTime(0.01, time + 0.16);
      time += 0.17;

      // 2. Play Data Nibbles
      for (let i = 0; i < nibbles.length; i++) {
        const freq = nibbleToFrequency(nibbles[i], activeConfig);
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.linearRampToValueAtTime(0.5, time + rampTime);
        gain.gain.linearRampToValueAtTime(0.5, time + symbolTime - rampTime);
        gain.gain.linearRampToValueAtTime(0.01, time + symbolTime);

        // Schedule visual progress
        const currentIdx = i + 1;
        setTimeout(() => {
          setBroadcastProgress({
            current: currentIdx,
            total: nibbles.length,
            currentFreq: freq,
          });
        }, (time - ctx.currentTime) * 1000);

        time += symbolTime;
      }

      // 3. Play Stop / Postamble Tone (160ms)
      osc.frequency.setValueAtTime(activeConfig.stopFreq, time);
      gain.gain.linearRampToValueAtTime(0.5, time + rampTime);
      gain.gain.linearRampToValueAtTime(0.5, time + 0.16 - rampTime);
      gain.gain.linearRampToValueAtTime(0, time + 0.16);
      time += 0.17;

      // Schedule cleanup & save sent item to history
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        } catch {
          // Ignore
        }
        setIsBroadcasting(false);
        setBroadcastProgress(null);
        oscNodeRef.current = null;
        gainNodeRef.current = null;

        addTransferHistoryItem({
          direction: "sent",
          mode: "Ultrasonic Sound",
          itemType: encoded.isBinary ? "file" : "text",
          name: encoded.fileName,
          size: encoded.fileSize,
          status: "completed",
          textSnippet: !encoded.isBinary ? selectedPayload.text.slice(0, 50) : undefined,
        });
      }, (time - ctx.currentTime) * 1000 + 50);
    } catch (err) {
      console.error("Ultrasonic broadcast error:", err);
      setIsBroadcasting(false);
      setBroadcastProgress(null);
    }
  }, [selectedPayload, activeConfig, getAudioContext]);

  const stopBroadcasting = useCallback(() => {
    if (oscNodeRef.current) {
      try {
        oscNodeRef.current.stop();
        oscNodeRef.current.disconnect();
      } catch {
        // Ignore
      }
      oscNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // Ignore
      }
      gainNodeRef.current = null;
    }
    setIsBroadcasting(false);
    setBroadcastProgress(null);
  }, []);

  // RECEIVE / LISTEN VIA MICROPHONE
  const startListening = useCallback(async () => {
    setMicError(null);
    setReceivedPayload(null);
    setReceiveSymbolsCount(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();

      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      micStreamRef.current = stream;
      analyserRef.current = analyser;
      setIsListening(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);
      const sampleRate = ctx.sampleRate;
      const binWidth = sampleRate / analyser.fftSize;

      let isCapturing = false;
      const collectedNibbles: number[] = [];
      let lastDetectedSymbol: number | null = null;
      let symbolConsecutiveFrames = 0;

      const detectLoop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatFrequencyData(dataArray);

        // Find peak frequency in the detection window
        const minFreq = preset === "nearUltrasonic" ? 17000 : 1300;
        const maxFreq = preset === "nearUltrasonic" ? 20200 : 3200;

        const minBin = Math.floor(minFreq / binWidth);
        const maxBin = Math.min(Math.floor(maxFreq / binWidth), bufferLength - 1);

        let maxVal = -Infinity;
        let peakBin = minBin;

        for (let b = minBin; b <= maxBin; b++) {
          if (dataArray[b] > maxVal) {
            maxVal = dataArray[b];
            peakBin = b;
          }
        }

        const peakFreq = peakBin * binWidth;
        const threshold = preset === "nearUltrasonic" ? -75 : -60;

        if (maxVal > threshold) {
          setDetectedFreq(Math.round(peakFreq));
          const toneType = classifyTone(peakFreq, activeConfig);

          if (toneType === "start") {
            isCapturing = true;
            collectedNibbles.length = 0;
            lastDetectedSymbol = null;
            symbolConsecutiveFrames = 0;
            setReceiveSymbolsCount(0);
          } else if (isCapturing && toneType === "stop") {
            isCapturing = false;
            const parsed = decodeAcousticNibblesToPayload(collectedNibbles);
            if (parsed) {
              setReceivedPayload(parsed);

              // Auto-save to session history
              addTransferHistoryItem({
                direction: "received",
                mode: "Ultrasonic Sound",
                itemType: parsed.isBinary ? "file" : "text",
                name: parsed.fileName,
                size: parsed.size,
                status: "completed",
                textSnippet: !parsed.isBinary ? parsed.data.slice(0, 50) : undefined,
              });

              // Auto-download for file payloads
              if (parsed.isBinary && parsed.blob) {
                try {
                  const url = URL.createObjectURL(parsed.blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = parsed.fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 15000);
                } catch {
                  // Ignore
                }
              }
            }
          } else if (isCapturing && toneType === "data") {
            const nibble = frequencyToNibble(peakFreq, activeConfig);
            if (nibble !== null) {
              if (nibble === lastDetectedSymbol) {
                symbolConsecutiveFrames++;
                // Require at least 2 consecutive frames for stable symbol latching
                if (symbolConsecutiveFrames === 2) {
                  collectedNibbles.push(nibble);
                  setReceiveSymbolsCount(collectedNibbles.length);
                }
              } else {
                lastDetectedSymbol = nibble;
                symbolConsecutiveFrames = 1;
              }
            }
          }
        } else {
          setDetectedFreq(null);
          lastDetectedSymbol = null;
          symbolConsecutiveFrames = 0;
        }

        // Draw spectrum onto canvas
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const canvasCtx = canvas.getContext("2d");
          if (canvasCtx) {
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            const sliceWidth = canvas.width / (maxBin - minBin);
            let x = 0;

            for (let b = minBin; b <= maxBin; b++) {
              const val = dataArray[b];
              const percent = Math.max(0, Math.min(1, (val + 100) / 70));
              const barHeight = percent * canvas.height;

              const isPeak = b === peakBin && maxVal > threshold;
              canvasCtx.fillStyle = isPeak
                ? "#10B981"
                : preset === "nearUltrasonic"
                ? "rgba(99, 102, 241, 0.45)"
                : "rgba(168, 85, 247, 0.45)";

              canvasCtx.fillRect(x, canvas.height - barHeight, sliceWidth, barHeight);
              x += sliceWidth;
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(detectLoop);
      };

      animFrameRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      setMicError(
        err instanceof Error
          ? err.message
          : "Microphone permission was denied. Allow microphone access to decode ultrasonic sound."
      );
      setIsListening(false);
    }
  }, [activeConfig, getAudioContext, preset]);

  const stopListening = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
    setDetectedFreq(null);
  }, []);

  const handleCopy = async () => {
    if (!receivedPayload?.data) return;
    try {
      await navigator.clipboard.writeText(receivedPayload.data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleDownloadFile = () => {
    if (!receivedPayload?.blob) return;
    try {
      const url = URL.createObjectURL(receivedPayload.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = receivedPayload.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch {
      // Ignore
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcasting();
      stopListening();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopBroadcasting, stopListening]);

  return (
    <div className="w-full glass-card p-5 sm:p-7 rounded-3xl space-y-6 border border-[var(--border-hairline)] bg-[var(--surface)] shadow-sm">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-500 animate-pulse" />
            <h3 className="font-bold text-base text-[var(--text)]">
              Ultrasonic Sound Data Transfer
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Experimental
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Over-the-air acoustic data transfer using inaudible soundwaves (18–20 kHz). Broadcast via speaker and decode via microphone.
          </p>
        </div>

        {/* Frequency Preset Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              stopBroadcasting();
              stopListening();
              setPreset("nearUltrasonic");
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
              preset === "nearUltrasonic"
                ? "bg-[var(--text)] text-[var(--surface)]"
                : "bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            Near-Ultrasonic (18–20 kHz)
          </button>
          <button
            type="button"
            onClick={() => {
              stopBroadcasting();
              stopListening();
              setPreset("audibleChirp");
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
              preset === "audibleChirp"
                ? "bg-[var(--text)] text-[var(--surface)]"
                : "bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            Audible Chirp (1.5–3 kHz)
          </button>
        </div>
      </div>

      {/* 2-PARTITION RESPONSIVE GRID (LEFT: DROPZONE | RIGHT: ENGINE) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* LEFT PARTITION: FILE DRAG & DROP + TEXT PAYLOAD */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text)]">
                1. Select Payload (Files or Text)
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelectedPayload({
                    files: [],
                    text: `PIN: ${Math.floor(100000 + Math.random() * 900000)}`,
                  })
                }
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Random PIN</span>
              </button>
            </div>

            <Dropzone
              onSelectionChange={(payload: { files: File[]; text: string }) => {
                setSelectedPayload(payload);
              }}
            />
          </div>

          {/* Payload Summary Info */}
          <div className="pt-2 border-t border-[var(--border-hairline)] space-y-1.5 text-xs text-[var(--text-muted)]">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span>Active Selection:</span>
              <span className="font-semibold text-[var(--text)] truncate max-w-[180px]">
                {selectedPayload.files.length > 0
                  ? `${selectedPayload.files[0].name} (${formatBytes(selectedPayload.files[0].size)})`
                  : selectedPayload.text.trim()
                  ? `Text: "${selectedPayload.text.slice(0, 20)}..."`
                  : "No payload selected"}
              </span>
            </div>
            <p className="text-[10px] leading-relaxed opacity-80">
              Acoustic bandwidth is ~15 bytes/sec. Best suited for small files (&lt; 2 KB), cryptographic keys, contact cards, and 6-digit session PINs.
            </p>
          </div>
        </div>

        {/* RIGHT PARTITION: SPEAKER BROADCAST & MICROPHONE RECEIVER */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col justify-between space-y-4">
          {/* Role Segmented Toggle */}
          <div className="flex items-center justify-center">
            <div className="inline-flex p-1 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] w-full max-w-xs shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  setRole("send");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  role === "send"
                    ? "bg-[var(--accent)] text-[var(--bg)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 fill-current" />
                <span>Send (Speaker)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopBroadcasting();
                  setRole("receive");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  role === "receive"
                    ? "bg-[var(--accent)] text-[var(--bg)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Mic className="w-3.5 h-3.5 fill-current" />
                <span>Receive (Mic)</span>
              </button>
            </div>
          </div>

          {/* TRANSMITTER VIEW (SPEAKER) */}
          {role === "send" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform ${
                  isBroadcasting
                    ? "bg-purple-600 animate-pulse scale-105"
                    : "bg-[var(--accent)]"
                }`}
              >
                <Volume2 className="w-7 h-7 text-[var(--bg)]" />
              </div>

              {isBroadcasting ? (
                <div className="w-full max-w-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      Broadcasting Soundwaves...
                    </span>
                    {broadcastProgress?.currentFreq && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {broadcastProgress.currentFreq} Hz
                      </span>
                    )}
                  </div>

                  {broadcastProgress && (
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-[var(--surface-muted)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 transition-all duration-100"
                          style={{
                            width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-[var(--text-muted)]">
                        <span>Symbol {broadcastProgress.current} / {broadcastProgress.total}</span>
                        <span>{Math.round((broadcastProgress.current / broadcastProgress.total) * 100)}%</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={stopBroadcasting}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer mt-1"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Sound</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={startBroadcasting}
                    disabled={selectedPayload.files.length === 0 && !selectedPayload.text.trim()}
                    className="w-full py-3 px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-[var(--bg)]" />
                    <span>Transmit via Sound</span>
                  </button>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Hold the receiving device&apos;s microphone close to this speaker.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* RECEIVER VIEW (MICROPHONE) */}
          {role === "receive" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
              {micError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-400 text-xs flex items-center gap-2 w-full">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{micError}</span>
                </div>
              )}

              {/* Live Canvas FFT Spectrum Visualizer */}
              <div className="w-full h-20 rounded-xl bg-black/90 overflow-hidden border border-neutral-800 relative flex items-center justify-center shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={80}
                  className="w-full h-full object-cover"
                />
                {!isListening && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono text-neutral-400 bg-black/60">
                    Microphone scanner idle
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isListening ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
                  }`}
                />
                <span className="text-[var(--text)]">
                  {isListening
                    ? detectedFreq
                      ? `Detected Tone: ${detectedFreq} Hz`
                      : "Listening for acoustic tones..."
                    : "Activate microphone to scan"}
                </span>
              </div>

              {/* Listening Controls */}
              {isListening ? (
                <div className="space-y-1.5 w-full">
                  {receiveSymbolsCount > 0 && (
                    <span className="font-mono text-xs text-purple-600 dark:text-purple-400 font-semibold block">
                      Capturing acoustic packet ({receiveSymbolsCount} symbols)...
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={stopListening}
                    className="px-4 py-2 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Listening</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startListening}
                  className="w-full max-w-xs py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg)] font-bold text-xs shadow-xs transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 fill-current text-[var(--bg)]" />
                  <span>Start Microphone Scanner</span>
                </button>
              )}

              {/* Decoded Received Payload Result */}
              {receivedPayload && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2.5 w-full animate-in fade-in">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Acoustic Payload Decoded!</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] font-mono text-xs font-bold text-[var(--text)] break-all select-all flex items-center justify-center gap-2">
                    {receivedPayload.isBinary ? (
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>{receivedPayload.fileName} ({formatBytes(receivedPayload.size || 0)})</span>
                      </div>
                    ) : (
                      <span>{receivedPayload.data}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    {receivedPayload.isBinary ? (
                      <button
                        type="button"
                        onClick={handleDownloadFile}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download File</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? "Copied!" : "Copy Text"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
