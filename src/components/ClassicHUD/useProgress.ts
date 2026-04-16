"use client";

import { useEffect, useRef, useState } from "react";
import type { YTPlayer } from "./types";

export interface ProgressState {
  barRef: React.RefObject<HTMLDivElement | null>;
  progress: number;
  currentTime: number;
  duration: number;
  handleScrubStart: (e: React.MouseEvent) => void;
}

export function useProgress(playerRef: React.RefObject<YTPlayer | null>): ProgressState {
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime || isScrubbing) return;
      const t = player.getCurrentTime() ?? 0;
      const d = player.getDuration() ?? 0;
      setCurrentTime(t);
      setDuration(d);
      setProgress(d > 0 ? (t / d) * 100 : 0);
    }, 500);
    return () => clearInterval(interval);
  }, [playerRef, isScrubbing]);

  function scrubFromEvent(e: React.MouseEvent | MouseEvent) {
    const bar = barRef.current;
    const player = playerRef.current;
    if (!bar || !player?.seekTo || !player?.getDuration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const d = player.getDuration() ?? 0;
    setProgress(pct * 100);
    setCurrentTime(pct * d);
    player.seekTo(pct * d, true);
  }

  function handleScrubStart(e: React.MouseEvent) {
    e.preventDefault();
    setIsScrubbing(true);
    scrubFromEvent(e);
    function onMove(ev: MouseEvent) { scrubFromEvent(ev); }
    function onUp() {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return { barRef, progress, currentTime, duration, handleScrubStart };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
