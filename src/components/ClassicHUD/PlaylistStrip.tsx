"use client";

import { useState } from "react";
import type { Video } from "./types";

interface Props {
  videos: Video[];
  currentVideoIndex: number;
  seenVideoIds?: Set<string>;
  onJumpToVideo: (index: number) => void;
}

export default function PlaylistStrip({
  videos,
  currentVideoIndex,
  seenVideoIds,
  onJumpToVideo,
}: Props) {
  const [badThumbs, setBadThumbs] = useState<Set<string>>(new Set());

  function handleThumbLoad(videoId: string, e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth === 120 && img.naturalHeight === 90) {
      setBadThumbs((prev) => new Set(prev).add(videoId));
    }
  }

  function handleThumbError(videoId: string) {
    setBadThumbs((prev) => new Set(prev).add(videoId));
  }

  return (
    <div className="hud-playlist-strip" aria-label="Playlist" role="group">
      <div className="flex gap-1.5 overflow-x-auto px-2 py-1.5 scrollbar-hide min-[1600px]:gap-2 min-[1600px]:px-3 min-[1600px]:py-2 min-[2000px]:gap-2.5 min-[2000px]:px-4 min-[2000px]:py-2.5">
        {videos.map((v, i) => {
          if (badThumbs.has(v.youtube_id)) return null;
          const isActive = i === currentVideoIndex;
          const isSeen = seenVideoIds?.has(v.id) ?? false;
          const thumbUrl =
            v.thumbnail_url ||
            `https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`;
          return (
            <button
              key={v.id}
              onClick={() => onJumpToVideo(i)}
              aria-label={`Play: ${v.title}${isActive ? " (now playing)" : ""}`}
              aria-current={isActive ? "true" : undefined}
              className={`shrink-0 w-[80px] h-[45px] rounded overflow-hidden relative cursor-pointer min-[1600px]:w-[108px] min-[1600px]:h-[60px] min-[2000px]:w-[128px] min-[2000px]:h-[72px] ${
                isActive ? "ring-1 ring-accent" : "opacity-60 hover:opacity-100"
              } transition-opacity`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover"
                onLoad={(e) => handleThumbLoad(v.youtube_id, e)}
                onError={() => handleThumbError(v.youtube_id)}
              />
              {isActive ? (
                <>
                  <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-white/90 tracking-wider min-[1600px]:text-[10px] min-[2000px]:text-xs"
                    aria-hidden="true"
                  >
                    NOW
                  </div>
                </>
              ) : isSeen ? (
                <div className="absolute bottom-0.5 right-0.5 min-[1600px]:bottom-1 min-[1600px]:right-1" aria-label="Watched">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-green-400/80 min-[1600px]:w-3.5 min-[1600px]:h-3.5 drop-shadow-sm" aria-hidden="true">
                    <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm3.1 4.7L7.1 9.8 4.9 7.6l-.8.8 3 3 4.8-4.8-.8-.9z" />
                  </svg>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
