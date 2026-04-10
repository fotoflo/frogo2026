"use client";

/**
 * Trim editor — embeds a YouTube player with controls so the editor can
 * scrub, then "Set start" / "Set end" captures the current playhead. Numeric
 * inputs (in seconds) allow fine adjustment. Save persists to the DB via
 * `updateVideoTrim`; Cancel closes without changes.
 *
 * Reuses the shared `YouTubePlayer` in "controls on, unmuted" mode. The
 * player instance is stashed via `onReady` so we can poll `getCurrentTime()`.
 */
import { useRef, useState } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";

interface TrimEditorProps {
  youtubeId: string;
  durationSeconds: number;
  initialStart: number | null;
  initialEnd: number | null;
  onSave: (start: number | null, end: number | null) => void;
  onCancel: () => void;
}

export default function TrimEditor({
  youtubeId,
  durationSeconds,
  initialStart,
  initialEnd,
  onSave,
  onCancel,
}: TrimEditorProps) {
  const [start, setStart] = useState<string>(
    initialStart != null ? String(initialStart) : ""
  );
  const [end, setEnd] = useState<string>(
    initialEnd != null ? String(initialEnd) : ""
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  const parseOrNull = (s: string): number | null => {
    const trimmed = s.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  const currentTime = (): number => {
    const p = playerRef.current;
    if (!p?.getCurrentTime) return 0;
    try {
      return Math.floor(p.getCurrentTime());
    } catch {
      return 0;
    }
  };

  const handleSetStart = () => setStart(String(currentTime()));
  const handleSetEnd = () => setEnd(String(currentTime()));

  const handlePreviewStart = () => {
    const p = playerRef.current;
    const s = parseOrNull(start) ?? 0;
    try {
      p?.seekTo?.(s, true);
      p?.playVideo?.();
    } catch {
      // ignore
    }
  };

  const handleSave = () => {
    const s = parseOrNull(start);
    const e = parseOrNull(end);

    if (s != null && e != null && s >= e) {
      alert("Start must be less than end");
      return;
    }
    if (e != null && e > durationSeconds) {
      alert(
        `End (${e}s) is past the video's native duration (${durationSeconds}s)`
      );
      return;
    }
    onSave(s, e);
  };

  const handleClear = () => {
    setStart("");
    setEnd("");
  };

  return (
    <div className="space-y-4">
      {/* Player */}
      <div className="aspect-video w-full max-w-2xl rounded overflow-hidden bg-black">
        <YouTubePlayer
          videoId={youtubeId}
          startSeconds={initialStart ?? 0}
          controls
          muted={false}
          onReady={(player) => {
            playerRef.current = player;
          }}
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div className="space-y-1">
          <label className="block text-xs text-neutral-500">
            Start (seconds)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="0"
              className="flex-1 px-3 py-2 rounded bg-neutral-950 border border-neutral-700 font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleSetStart}
              className="px-3 py-2 text-sm rounded border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 transition whitespace-nowrap"
            >
              Set from player
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-neutral-500">
            End (seconds){" "}
            <span className="text-neutral-600">
              — native length {durationSeconds}s
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder={String(durationSeconds)}
              className="flex-1 px-3 py-2 rounded bg-neutral-950 border border-neutral-700 font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleSetEnd}
              className="px-3 py-2 text-sm rounded border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 transition whitespace-nowrap"
            >
              Set from player
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 rounded bg-white text-black font-medium hover:bg-white/90 transition"
        >
          Save trim
        </button>
        <button
          type="button"
          onClick={handlePreviewStart}
          className="px-4 py-2 rounded border border-neutral-700 hover:border-neutral-500 transition text-sm"
        >
          Preview from start
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 rounded border border-neutral-700 hover:border-neutral-500 transition text-sm"
        >
          Clear trim
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto px-4 py-2 text-sm text-neutral-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
