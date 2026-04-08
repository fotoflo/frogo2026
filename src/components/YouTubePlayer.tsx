"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

const YT_ENDED = 0;

let ytScriptAdded = false;
const ytReadyCallbacks: (() => void)[] = [];

function ensureYTApi(callback: () => void) {
  if (window.YT?.Player) {
    callback();
    return;
  }
  ytReadyCallbacks.push(callback);
  if (!ytScriptAdded) {
    ytScriptAdded = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      for (const cb of ytReadyCallbacks) cb();
      ytReadyCallbacks.length = 0;
    };
  }
}

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  const onReadyRef = useRef(onReady);
  const onStateChangeRef = useRef(onStateChange);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  useLayoutEffect(() => {
    onReadyRef.current = onReady;
    onStateChangeRef.current = onStateChange;
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;
  });

  const initialVideoId = useRef(videoId);
  const initialStart = useRef(startSeconds);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Create a fresh div for YouTube to replace with its iframe.
    // This survives React strict mode's mount-unmount-mount cycle
    // because we always create a new target div.
    const target = document.createElement("div");
    target.style.width = "100%";
    target.style.height = "100%";
    wrapper.appendChild(target);

    ensureYTApi(() => {
      // Guard: if cleanup already ran, don't create player
      if (!wrapper.contains(target)) return;

      playerRef.current = new window.YT.Player(target, {
        width: "100%",
        height: "100%",
        videoId: initialVideoId.current,
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          iv_load_policy: 3,
          fs: 0,
          start: initialStart.current ? Math.floor(initialStart.current) : undefined,
        },
        events: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onReady: (e: any) => onReadyRef.current?.(e.target),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            onStateChangeRef.current?.(e.data);
            if (e.data === YT_ENDED) {
              onEndedRef.current?.();
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (e: any) => onErrorRef.current?.(e.data),
        },
      });
    });

    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
      // Clean up any remaining DOM
      while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
      }
    };
  }, []);

  // When videoId changes after mount, load the new video
  useEffect(() => {
    if (videoId === initialVideoId.current) {
      initialVideoId.current = "";
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
      <div ref={wrapperRef} className="w-full h-full" />
      <div className="absolute inset-0 z-10" />
    </div>
  );
}
