"use client";

import { useEffect, useState } from "react";
import ShareButton from "./ShareButton";
import type { RemoteState } from "./useRemoteState";

interface NowPlayingCardProps {
  state: RemoteState;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export default function NowPlayingCard({ state, isFavorite, onToggleFavorite }: NowPlayingCardProps) {
  const { video, channel, playbackState, playbackPosition } = state;
  const [countdownOffset, setCountdownOffset] = useState(0);

  const remaining = video ? Math.max(0, video.duration_seconds - playbackPosition - countdownOffset) : 0;

  useEffect(() => {
    if (playbackState !== "playing" || remaining <= 0) return;
    const interval = setInterval(() => {
      setCountdownOffset((o) => o + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [playbackState, remaining]);

  if (!video || state.loading) return null;

  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);

  return (
    <div className="mx-5 mb-3 rounded-xl bg-white/5 border border-white/8 p-3 relative z-10">
      <div className="flex gap-3">
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt=""
            className="w-20 h-14 rounded-lg object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            <div className="text-xs font-medium text-white/80 truncate flex-1">{video.title}</div>
            <button
              onClick={onToggleFavorite}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="shrink-0 text-sm leading-none touch-manipulation"
            >
              {isFavorite ? "★" : "☆"}
            </button>
          </div>
          {channel && (
            <div className="text-[10px] text-white/40 mt-0.5 truncate">
              {channel.icon} {channel.name}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${playbackState === "playing" ? "bg-green-400" : "bg-yellow-500"}`} />
            <span className="text-[10px] text-white/30 font-mono flex-1">
              {mins}:{secs.toString().padStart(2, "0")} left
            </span>
            <ShareButton state={state} />
          </div>
        </div>
      </div>
    </div>
  );
}
