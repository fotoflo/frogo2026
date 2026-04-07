"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// YouTube Player States
const YT_ENDED = 0;

interface YouTubePlayerProps {
  videoId: string;
  onStateChange?: (state: number) => void;
  onReady?: (player: any) => void;
  onEnded?: () => void;
}

export default function YouTubePlayer({
  videoId,
  onStateChange,
  onReady,
  onEnded,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const initPlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return;

    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
      },
      events: {
        onReady: (e: any) => onReady?.(e.target),
        onStateChange: (e: any) => {
          onStateChange?.(e.data);
          if (e.data === YT_ENDED) {
            onEnded?.();
          }
        },
      },
    });
  }, [videoId, onReady, onStateChange, onEnded]);

  useEffect(() => {
    if (window.YT?.Player) {
      initPlayer();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = initPlayer;

    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [initPlayer]);

  useEffect(() => {
    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId]);

  return (
    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
