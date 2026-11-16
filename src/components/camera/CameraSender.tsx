"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dropzone } from "@/components/Dropzone";
import { SegmentedControl } from "@/components/SegmentedControl";
import { EstimateBadge } from "@/components/EstimateBadge";
import {
  encodeFileToOpticalFrames,
  encodeTextToOpticalFrames,
  buildParityFrames,
  OPTICAL_CHUNK_PRESETS,
  type OpticalChunkPreset,
  type OpticalDataFrame,
} from "@/lib/opticalDataStream";
import { decodeRecoveryCode } from "@/lib/opticalRecovery";

export type CameraLayout = "single" | "2x2" | "2x3";

export function parseLayoutDims(layout: CameraLayout): { cols: number; rows: number } {
  if (layout === "single") return { cols: 1, rows: 1 };
  const [cols, rows] = layout.split("x").map(Number);
  return { cols: cols || 1, rows: rows || 1 };
}

export function getFramesPerTick(layout: CameraLayout): number {
  const { cols, rows } = parseLayoutDims(layout);
  return cols * rows;
}

export interface CameraSenderProps {
  initialLayout?: CameraLayout;
  initialPreset?: OpticalChunkPreset;
  className?: string;
}

export function CameraSender({
  initialLayout = "single",
  initialPreset = "medium",
  className = "",
}: CameraSenderProps) {
  // Sender state (Starts paused on Frame 1 with default Single layout and Medium density)
  const [frames, setFrames] = useState<OpticalDataFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(320); // 320ms normal speed
  const [isEncoding, setIsEncoding] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<OpticalChunkPreset>(initialPreset);
  const [activePayload, setActivePayload] = useState<{ files: File[]; text: string } | null>(null);
  const [senderLayout, setSenderLayout] = useState<CameraLayout>(initialLayout);

  // Sender recovery replay state
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [replayIndices, setReplayIndices] = useState<number[] | null>(null);

  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Re-encode payload with given chunk preset and parity frames
  const encodePayload = useCallback(
    async (payload: { files: File[]; text: string }, preset: OpticalChunkPreset) => {
      setIsEncoding(true);
      try {
        let dataFrames: OpticalDataFrame[] = [];
        const chunkSize = OPTICAL_CHUNK_PRESETS[preset];
        if (payload.files.length > 0) {
          dataFrames = await encodeFileToOpticalFrames(payload.files[0], chunkSize);
        } else if (payload.text.trim()) {
          dataFrames = await encodeTextToOpticalFrames(payload.text.trim(), chunkSize);
        }
        const parityFrames = buildParityFrames(dataFrames, chunkSize);
        const allFrames = [...dataFrames, ...parityFrames];
        setFrames(allFrames);
        setCurrentFrameIndex(0);
        setIsPlaying(false);
        setHasStartedStreaming(false);
        setReplayIndices(null);
        setRecoveryInput("");
        setRecoveryError(null);
      } catch (err) {
        console.error("Failed to encode payload to optical frames:", err);
      } finally {
        setIsEncoding(false);
      }
    },
    []
  );

  // Active frames displayed: full stream or replayed missing subset
  const displayedFrames =
    replayIndices !== null
      ? frames.filter((f) => !f.isParity && replayIndices.includes(f.chunkIndex))
      : frames;
  const activeFramesList = displayedFrames.length > 0 ? displayedFrames : frames;

  // Handle payload selection in sender mode
  const handlePayloadSelected = useCallback(
    async (payload: { files: File[]; text: string }) => {
      setActivePayload(payload);
      await encodePayload(payload, selectedPreset);
    },
    [encodePayload, selectedPreset]
  );

  // Handle QR density preset changes
  const handlePresetChange = useCallback(
    async (newPreset: OpticalChunkPreset) => {
      setSelectedPreset(newPreset);
      if (activePayload) {
        await encodePayload(activePayload, newPreset);
      }
    },
    [activePayload, encodePayload]
  );

  // Frame cycling loop for sender
  useEffect(() => {
    const perTick = getFramesPerTick(senderLayout);
    const totalSteps = Math.ceil(activeFramesList.length / perTick);

    if (totalSteps <= 1 || !isPlaying) {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      return;
    }

    playbackTimerRef.current = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        if (perTick > 1) {
          const currentTick = Math.floor(prev / perTick);
          const nextTick = (currentTick + 1) % totalSteps;
          return nextTick * perTick;
        }
        return (prev + 1) % totalSteps;
      });
    }, speedMs);

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [activeFramesList.length, isPlaying, speedMs, senderLayout]);

  const handleApplyRecoveryCode = () => {
    if (!recoveryInput.trim()) {
      setRecoveryError("Please enter a recovery code.");
      return;
    }
    const sessionHash = frames[0]?.hash || "";
    const decoded = decodeRecoveryCode(recoveryInput.trim(), sessionHash);
    if (!decoded.ok) {
      if (decoded.reason === "word") {
        setRecoveryError("A word is not recognized.");
      } else if (decoded.reason === "session") {
        setRecoveryError("Recovery code is from a different transfer session.");
      } else if (decoded.reason === "checksum") {
        setRecoveryError("Recovery code checksum mismatch. Please recheck typing.");
      } else {
        setRecoveryError("Invalid recovery code format.");
      }
      return;
    }

    const validIndices = decoded.indices || [];
    const matching = frames.filter(
      (f) => !f.isParity && validIndices.includes(f.chunkIndex)
    );
    if (matching.length === 0) {
      setRecoveryError("No matching frames found for this code.");
      return;
    }

    setRecoveryError(null);
    setReplayIndices(validIndices);
    setCurrentFrameIndex(0);
    setIsPlaying(true);
    setHasStartedStreaming(true);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {isEncoding ? (
        <div className="flex flex-col items-center justify-center p-12 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl text-center space-y-2">
          <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-[var(--text)]">Compressing &amp; generating optical QR stream...</span>
        </div>
      ) : frames.length === 0 ? (
        <div className="space-y-3">
          <Dropzone onSelectionChange={handlePayloadSelected} />
          <p className="text-[11px] text-center text-[var(--text-muted)]">
            Files are compressed and converted into a sequenced stream of QR codes. Point the receiver camera at the screen to capture.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* QR Density and Layout Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl w-full">
            <div className="text-left w-full sm:w-auto">
              <div className="text-xs font-bold text-[var(--text)]">QR Density &amp; Layout</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Smaller is easier to scan, larger is faster
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                value={senderLayout}
                onChange={(val) => {
                  setSenderLayout(val as CameraLayout);
                  setCurrentFrameIndex(0);
                }}
                options={[
                  { value: "single", label: "Single" },
                  { value: "2x2", label: "2x2" },
                  { value: "2x3", label: "2x3" },
                ]}
                ariaLabel="Sender QR layout"
              />
              <SegmentedControl
                value={selectedPreset}
                onChange={(val) => {
                  handlePresetChange(val as OpticalChunkPreset);
                }}
                options={[
                  { value: "small", label: "Small" },
                  { value: "medium", label: "Medium" },
                  { value: "large", label: "Large" },
                ]}
                ariaLabel="QR density"
              />
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-muted)] text-center w-full">
            {senderLayout === "single"
              ? "Hard to scan? Use 2x2 or Medium density."
              : "Hard to scan? Use Single or Medium density."}
          </p>

          {/* QR Display Card */}
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-2xl">
            {(() => {
              const { cols, rows } = parseLayoutDims(senderLayout);
              const perTick = cols * rows;
              const tick = Math.floor(currentFrameIndex / perTick);
              const wrapperStyle =
                senderLayout === "single"
                  ? { width: "min(100%, 360px)" }
                  : { width: `min(100%, 520px, calc(80vh * ${cols} / ${rows}))` };

              const tickFrames = Array.from(
                { length: perTick },
                (_, i) => activeFramesList[tick * perTick + i] || null
              );

              return (
                <div
                  style={wrapperStyle}
                  className="mx-auto p-1 rounded-xl bg-white shadow-sm border border-neutral-200"
                >
                  <div
                    className="grid gap-[2px]"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {tickFrames.map((frame, idx) => (
                      <div
                        key={idx}
                        className="w-full bg-white flex items-center justify-center overflow-hidden"
                      >
                        {frame ? (
                          <QRCodeSVG
                            value={frame.encodedPayload}
                            size={256}
                            level="L"
                            marginSize={2}
                            shapeRendering="crispEdges"
                            style={{ width: "100%", height: "auto" }}
                          />
                        ) : (
                          <div className="w-full aspect-square bg-white" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Frame Counter & Progress Bar */}
            <div className="w-full max-w-sm mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text)] truncate max-w-[200px]">
                  {frames[0]?.fileName}
                </span>
                <span className="font-mono tabular-nums text-[11px]">
                  {(() => {
                    const perTick = getFramesPerTick(senderLayout);
                    const prefix = replayIndices !== null ? "Replay" : "Frames";
                    if (perTick === 1) {
                      return `${prefix} ${currentFrameIndex + 1} of ${activeFramesList.length}`;
                    }
                    const tick = Math.floor(currentFrameIndex / perTick);
                    const start = tick * perTick + 1;
                    const end = Math.min(tick * perTick + perTick, activeFramesList.length);
                    return start === end
                      ? `${prefix} ${start} of ${activeFramesList.length}`
                      : `${prefix} ${start} to ${end} of ${activeFramesList.length}`;
                  })()}
                </span>
              </div>

              <div className="flex justify-center">
                <EstimateBadge
                  channel="camera"
                  totalBytes={frames[0]?.fileSize || 1}
                  frames={frames.length}
                  frameIntervalMs={speedMs}
                  framesPerTick={getFramesPerTick(senderLayout)}
                />
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-150"
                  style={{
                    width: `${
                      (Math.min(
                        currentFrameIndex + getFramesPerTick(senderLayout),
                        activeFramesList.length
                      ) /
                        activeFramesList.length) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Playback & Speed Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => {
                  const perTick = getFramesPerTick(senderLayout);
                  const totalTicks = Math.ceil(activeFramesList.length / perTick);
                  const curTick = Math.floor(currentFrameIndex / perTick);
                  const prevTick = (curTick - 1 + totalTicks) % totalTicks;
                  setCurrentFrameIndex(prevTick * perTick);
                }}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                title="Previous Frame"
                aria-label="Previous Frame"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!hasStartedStreaming) {
                    setHasStartedStreaming(true);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying((prev) => !prev);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shadow-xs transition-opacity cursor-pointer"
              >
                {!hasStartedStreaming || (currentFrameIndex === 0 && !isPlaying) ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Start Stream
                  </>
                ) : isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Resume
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const perTick = getFramesPerTick(senderLayout);
                  const totalTicks = Math.ceil(activeFramesList.length / perTick);
                  const curTick = Math.floor(currentFrameIndex / perTick);
                  const nextTick = (curTick + 1) % totalTicks;
                  setCurrentFrameIndex(nextTick * perTick);
                }}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                title="Next Frame"
                aria-label="Next Frame"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentFrameIndex(0);
                  setIsPlaying(false);
                  setHasStartedStreaming(false);
                }}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer"
                title="Reset to Frame 1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Frame 1</span>
              </button>

              <div className="h-4 w-px bg-[var(--border-hairline)] mx-1 hidden sm:block" />

              {/* Speed Selector */}
              <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setSpeedMs(500)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                    speedMs === 500
                      ? "bg-[var(--text)] text-[var(--surface)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Slow
                </button>
                <button
                  type="button"
                  onClick={() => setSpeedMs(320)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                    speedMs === 320
                      ? "bg-[var(--text)] text-[var(--surface)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setSpeedMs(220)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                    speedMs === 220
                      ? "bg-[var(--text)] text-[var(--surface)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Fast
                </button>
              </div>
            </div>

            {/* Collapsible Replay Missing Frames Section */}
            <div className="w-full max-w-sm mt-4 pt-3 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setIsReplayOpen((prev) => !prev)}
                className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center justify-between w-full cursor-pointer"
              >
                <span>Replay missing frames</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  {isReplayOpen ? "Hide ▲" : "Show ▼"}
                </span>
              </button>

              {isReplayOpen && (
                <div className="mt-2.5 space-y-2">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Enter the recovery code from the receiver to loop only frames lost to camera shake.
                  </p>
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={recoveryInput}
                      onChange={(e) => {
                        setRecoveryInput(e.target.value);
                        setRecoveryError(null);
                      }}
                      placeholder="Type or paste the words, for example: tiger river lamp ..."
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-xs text-[var(--text)] focus:outline-none resize-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between">
                      {recoveryError ? (
                        <p className="text-[11px] text-red-500">{recoveryError}</p>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={handleApplyRecoveryCode}
                        className="px-3 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer ml-auto"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {replayIndices !== null && (
                <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    Replaying {replayIndices.length} missing frames
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplayIndices(null);
                      setCurrentFrameIndex(0);
                      setRecoveryInput("");
                    }}
                    className="text-[11px] font-semibold text-[var(--text)] hover:underline cursor-pointer"
                  >
                    Back to full stream
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Reset action */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setFrames([]);
                setCurrentFrameIndex(0);
                setIsPlaying(false);
                setHasStartedStreaming(false);
              }}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Choose another file or text
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CameraSender;
