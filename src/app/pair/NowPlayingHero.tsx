"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ShareButton from "./ShareButton";
import type { RemoteState } from "./useRemoteState";

interface NowPlayingHeroProps {
  state: RemoteState;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export default function NowPlayingHero({ state, isFavorite, onToggleFavorite }: NowPlayingHeroProps) {
  const { video, channel, playbackState, playbackPosition } = state;
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!video) return;
    setRemaining(Math.max(0, video.duration_seconds - playbackPosition));
  }, [video, playbackPosition]);

  useEffect(() => {
    if (playbackState !== "playing" || remaining <= 0) return;
    const interval = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(interval);
  }, [playbackState, remaining]);

  if (!video || state.loading) {
    return (
      <div className="rounded-2xl p-6 text-center"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-neutral-500 text-sm">Waiting for TV…</span>
      </div>
    );
  }

  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const progress = video.duration_seconds > 0
    ? ((video.duration_seconds - remaining) / video.duration_seconds) * 100
    : 0;

  return (
    <div className="rounded-2xl overflow-hidden relative"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
      {/* Thumbnail hero */}
      {video.thumbnail_url && (
        <div className="relative h-40 overflow-hidden">
          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #0e0e0e 0%, transparent 60%)" }} />
          {/* Playback badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
            <span className={`w-1.5 h-1.5 rounded-full ${playbackState === "playing" ? "bg-green-400 animate-pulse" : "bg-yellow-500"}`} />
            {playbackState === "playing" ? "LIVE" : "PAUSED"}
          </div>
        </div>
      )}

      {/* Info section */}
      <div className="px-4 pb-4 -mt-6 relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white leading-tight line-clamp-2"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              {video.title}
            </h2>
            {channel && (
              <p className="text-xs text-neutral-400 mt-1 truncate">
                {channel.icon} {channel.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <Link href={`/mobile/v/${video.id}`}
              className="flex items-center justify-center touch-manipulation transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
              aria-label="Watch on phone">
              <span className="material-symbols-outlined text-base">play_circle</span>
            </Link>
            <ShareButton state={state} />
            <button onClick={onToggleFavorite}
              className="text-lg leading-none touch-manipulation transition-transform active:scale-125"
              style={{ color: isFavorite ? "#cbff72" : "rgba(255,255,255,0.3)" }}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}>
              {isFavorite ? "★" : "☆"}
            </button>
          </div>
        </div>

        {/* Progress bar + time */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #cbff72, #a0cc5a)" }} />
          </div>
          <span className="text-[10px] font-mono text-neutral-500 shrink-0">
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
