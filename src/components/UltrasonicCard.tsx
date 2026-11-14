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
  AlertCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  textToNibbles,
  nibblesToText,
  nibbleToFrequency,
  frequencyToNibble,
  classifyTone,
  ULTRASONIC_PRESETS,
  type UltrasonicConfig,
} from "@/lib/ultrasonicStream";

type AcousticRole = "send" | "receive";
type AcousticPreset = "nearUltrasonic" | "audibleChirp";

export function UltrasonicCard() {
  const [role, setRole] = useState<AcousticRole>("send");
  const [preset, setPreset] = useState<AcousticPreset>("nearUltrasonic");
  const [sendText, setSendText] = useState("PIN: 749281");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{ current: number; total: number } | null>(null);

  // Receiver state
  const [isListening, setIsListening] = useState(false);
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [receivedText, setReceivedText] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [receiveSymbolsCount, setReceiveSymbolsCount] = useState(0);

  // Audio Context & node refs
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
    if (!sendText.trim()) return;

    try {
      const ctx = getAudioContext();
      setIsBroadcasting(true);
      setBroadcastProgress(null);

      const nibbles = textToNibbles(sendText.trim());
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

      // 1. Play Start / Preamble Tone (150ms)
      osc.frequency.setValueAtTime(activeConfig.startFreq, time);
      gain.gain.linearRampToValueAtTime(0.5, time + rampTime);
      gain.gain.linearRampToValueAtTime(0.5, time + 0.15 - rampTime);
      gain.gain.linearRampToValueAtTime(0.01, time + 0.15);
      time += 0.16;

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
          setBroadcastProgress({ current: currentIdx, total: nibbles.length });
        }, (time - ctx.currentTime) * 1000);

        time += symbolTime;
      }

      // 3. Play Stop / Postamble Tone (150ms)
      osc.frequency.setValueAtTime(activeConfig.stopFreq, time);
      gain.gain.linearRampToValueAtTime(0.5, time + rampTime);
      gain.gain.linearRampToValueAtTime(0.5, time + 0.15 - rampTime);
      gain.gain.linearRampToValueAtTime(0, time + 0.15);
      time += 0.16;

      // Schedule cleanup
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
      }, (time - ctx.currentTime) * 1000 + 50);
    } catch (err) {
      console.error("Ultrasonic broadcast error:", err);
      setIsBroadcasting(false);
      setBroadcastProgress(null);
    }
  }, [sendText, activeConfig, getAudioContext]);

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
    setReceivedText(null);
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
            const finalStr = nibblesToText(collectedNibbles);
            if (finalStr) {
              setReceivedText(finalStr);
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
              // Map dB from -100..-30 to 0..height
              const percent = Math.max(0, Math.min(1, (val + 100) / 70));
              const barHeight = percent * canvas.height;

              const isPeak = b === peakBin && maxVal > threshold;
              canvasCtx.fillStyle = isPeak
                ? "#10B981"
                : preset === "nearUltrasonic"
                ? "rgba(99, 102, 241, 0.4)"
                : "rgba(168, 85, 247, 0.4)";

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
          : "Microphone permission was denied. Allow microphone access to decode ultrasonic audio."
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
    if (!receivedText) return;
    try {
      await navigator.clipboard.writeText(receivedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    <div className="w-full glass-card p-6 sm:p-8 rounded-3xl space-y-6 border border-[var(--border-hairline)] bg-[var(--surface)] shadow-sm">
      {/* Header */}
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
            Over-the-air acoustic data transfer using inaudible sound waves (18–20 kHz). Broadcast via speaker and decode via microphone.
          </p>
        </div>

        {/* Preset & Frequency Band Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              stopBroadcasting();
              stopListening();
              setPreset("nearUltrasonic");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              preset === "audibleChirp"
                ? "bg-[var(--text)] text-[var(--surface)]"
                : "bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            Audible Chirp (1.5–3 kHz)
          </button>
        </div>
      </div>

      {/* Role Toggle: Speaker Broadcast vs Microphone Receiver */}
      <div className="flex items-center justify-center">
        <div className="inline-flex p-1 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={() => {
              stopListening();
              setRole("send");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              role === "send"
                ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <Volume2 className="w-4 h-4 text-[var(--accent)]" />
            <span>Broadcast (Speaker)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopBroadcasting();
              setRole("receive");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              role === "receive"
                ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <Mic className="w-4 h-4 text-purple-500" />
            <span>Listen (Microphone)</span>
          </button>
        </div>
      </div>

      {/* BROADCAST VIEW (SPEAKER) */}
      {role === "send" && (
        <div className="space-y-4 max-w-lg mx-auto">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text)] block">
              Text or Session PIN to Broadcast
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                placeholder="Enter text or PIN (e.g. PIN: 938102)"
                className="flex-1 p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs font-mono text-[var(--text)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSendText(`PIN: ${Math.floor(100000 + Math.random() * 900000)}`)}
                className="p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-[var(--surface)] text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer"
                title="Generate Random PIN"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {preset === "nearUltrasonic"
                ? "High-frequency tones (~18–20 kHz) are emitted through your device speakers, virtually silent to humans."
                : "Play audible acoustic chirps through device speakers."}
            </p>
          </div>

          {/* Broadcast Trigger */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center space-y-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md transition-transform ${
                isBroadcasting
                  ? "bg-purple-600 animate-pulse scale-110"
                  : "bg-neutral-900 dark:bg-white text-neutral-900 dark:text-neutral-900"
              }`}
            >
              <Volume2 className="w-7 h-7 text-white dark:text-neutral-900" />
            </div>

            {isBroadcasting ? (
              <div className="space-y-2 w-full max-w-xs">
                <span className="font-bold text-xs text-purple-600 dark:text-purple-400 block">
                  Broadcasting Acoustic Waves...
                </span>
                {broadcastProgress && (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-100"
                        style={{
                          width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      Symbol {broadcastProgress.current} of {broadcastProgress.total}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={stopBroadcasting}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Broadcast</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startBroadcasting}
                className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Transmit via Sound</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* RECEIVER VIEW (MICROPHONE) */}
      {role === "receive" && (
        <div className="space-y-4 max-w-lg mx-auto">
          {micError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{micError}</span>
            </div>
          )}

          <div className="p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col items-center justify-center space-y-4 text-center">
            {/* Live FFT Canvas Spectrum Visualizer */}
            <div className="w-full h-24 rounded-xl bg-black/80 overflow-hidden border border-neutral-800 relative flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={360}
                height={96}
                className="w-full h-full object-cover"
              />
              {!isListening && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-neutral-400 bg-black/60">
                  Microphone scanner idle
                </div>
              )}
            </div>

            {/* Status indicator */}
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
                  : "Click below to activate microphone"}
              </span>
            </div>

            {/* Listener Toggle */}
            {isListening ? (
              <div className="space-y-2">
                {receiveSymbolsCount > 0 && (
                  <span className="font-mono text-xs text-purple-600 dark:text-purple-400 font-semibold block">
                    Capturing acoustic packets ({receiveSymbolsCount} symbols)...
                  </span>
                )}
                <button
                  type="button"
                  onClick={stopListening}
                  className="px-5 py-2.5 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Listening</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startListening}
                className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Start Microphone Scanner</span>
              </button>
            )}
          </div>

          {/* Decoded Received Payload Result Card */}
          {receivedText && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3 animate-in fade-in">
              <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <Zap className="w-4 h-4" />
                <span>Acoustic Payload Decoded!</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] font-mono text-base font-extrabold text-[var(--text)] tracking-wider break-all select-all">
                {receivedText}
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy Text"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
