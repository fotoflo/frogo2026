"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const YT_ENDED = 0;

interface YouTubePlayerProps {
  videoId: string;
  startSeconds?: number;
  onStateChange?: (state: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onReady?: (player: any) => void;
  onEnded?: () => void;
  onError?: (errorCode: number) => void;
}

export default function YouTubePlayer({
  videoId,
  startSeconds,
  onStateChange,
  onReady,
  onEnded,
  onError,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  const initPlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return;

    playerRef.current = new window.YT.Player(containerRef.current, {
      width: "100%",
      height: "100%",
      videoId,
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        iv_load_policy: 3,
        fs: 0,
        start: startSeconds ? Math.floor(startSeconds) : undefined,
      },
      events: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onReady: (e: any) => onReady?.(e.target),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onStateChange: (e: any) => {
          onStateChange?.(e.data);
          if (e.data === YT_ENDED) {
            onEnded?.();
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (e: any) => onError?.(e.data),
      },
    });
  }, [videoId, startSeconds, onReady, onStateChange, onEnded, onError]);

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

  // When videoId changes AFTER initial mount, load the new video
  const initialVideoRef = useRef(videoId);
  useEffect(() => {
    // Skip on first mount — initPlayer already handles it with the start param
    if (videoId === initialVideoRef.current) {
      initialVideoRef.current = "";
      return;
    }
    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById({
        videoId,
        startSeconds: startSeconds ? Math.floor(startSeconds) : 0,
      });
    }
  }, [videoId, startSeconds]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={containerRef} className="w-full h-full" />
      {/* Transparent overlay blocks all mouse interaction with the iframe */}
      <div className="absolute inset-0 z-10" />
    </div>
  );
}
