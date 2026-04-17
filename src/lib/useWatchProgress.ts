"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Resume-from-last playback. Three layers of persistence:
 *   - URL `?v=&t=` — updated every 5s, powers same-tab reload
 *   - localStorage `frogo:channel:<channelId>` — per-channel last position
 *   - `/api/history` DB write — on video finish or every 5 minutes
 *
 * Call `readInitialResume(channelId)` on mount to seed the player.
 * Mount the hook to keep URL + localStorage + DB in sync while the
 * user is on a given video.
 */

type YTPlayer = {
  getCurrentTime?: () => number;
  getPlayerState?: () => number;
};

const YT_PLAYING = 1;

const LS_PREFIX = "frogo:channel:";
const LS_LAST = "frogo:lastChannel";
const LIVE_TICK_MS = 5_000;
const DB_TICK_MS = 5 * 60 * 1_000;

export interface ResumeState {
  videoId: string | null;
  positionSeconds: number;
}

/**
 * Read initial resume state for a channel. URL wins over localStorage.
 * Safe to call during SSR — returns a null/zero state server-side.
 */
export function readInitialResume(channelId: string): ResumeState {
  if (typeof window === "undefined") return { videoId: null, positionSeconds: 0 };

  const params = new URLSearchParams(window.location.search);
  const urlVideo = params.get("v");
  const urlT = params.get("t");
  if (urlVideo) {
    return {
      videoId: urlVideo,
      positionSeconds: urlT ? Math.max(0, parseInt(urlT, 10) || 0) : 0,
    };
  }

  try {
    const raw = window.localStorage.getItem(LS_PREFIX + channelId);
    if (!raw) return { videoId: null, positionSeconds: 0 };
    const parsed = JSON.parse(raw) as { videoId?: string; position?: number };
    if (!parsed.videoId) return { videoId: null, positionSeconds: 0 };
    return {
      videoId: parsed.videoId,
      positionSeconds: Math.max(0, Math.floor(parsed.position ?? 0)),
    };
  } catch {
    return { videoId: null, positionSeconds: 0 };
  }
}

function writeLocal(channelId: string, videoId: string, position: number) {
  try {
    window.localStorage.setItem(
      LS_PREFIX + channelId,
      JSON.stringify({ videoId, position: Math.floor(position), updatedAt: Date.now() })
    );
    window.localStorage.setItem(LS_LAST, channelId);
  } catch {
    // quota/permission errors — ignore
  }
}

function writeUrl(videoId: string, position: number, basePath: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("v", videoId);
  params.set("t", String(Math.floor(position)));
  const qs = params.toString();
  window.history.replaceState(null, "", `${basePath}?${qs}`);
}

function postHistory(body: {
  videoId: string;
  channelId: string;
  positionSeconds: number;
  event?: "seen" | "skip";
}) {
  fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

interface Options {
  channelId: string;
  videoId: string | null;
  /** Base pathname (without query) to keep on the URL, e.g. /watch/foo/bar. */
  basePath: string;
  playerRef: React.RefObject<YTPlayer | null>;
}

export function useWatchProgress({ channelId, videoId, basePath, playerRef }: Options) {
  const lastDbWriteRef = useRef(0);

  const getPosition = useCallback((): number => {
    const p = playerRef.current;
    if (!p?.getCurrentTime) return 0;
    try {
      return p.getCurrentTime() ?? 0;
    } catch {
      return 0;
    }
  }, [playerRef]);

  // 5s tick: URL + localStorage (no network).
  // Only writes when the player is actually playing — avoids overwriting
  // resume data before the player is ready on mount.
  useEffect(() => {
    if (!videoId) return;
    const tick = () => {
      const p = playerRef.current;
      if (!p?.getPlayerState || p.getPlayerState() !== YT_PLAYING) return;
      const pos = getPosition();
      writeLocal(channelId, videoId, pos);
      writeUrl(videoId, pos, basePath);
    };
    const id = setInterval(tick, LIVE_TICK_MS);
    return () => clearInterval(id);
  }, [channelId, videoId, basePath, getPosition, playerRef]);

  // 5min tick: DB write
  useEffect(() => {
    if (!videoId) return;
    const id = setInterval(() => {
      const pos = getPosition();
      lastDbWriteRef.current = Date.now();
      postHistory({ channelId, videoId, positionSeconds: pos });
    }, DB_TICK_MS);
    return () => clearInterval(id);
  }, [channelId, videoId, getPosition]);

  /** Caller invokes when a video finishes naturally. Flushes `seen` + position. */
  const commitSeen = useCallback(() => {
    if (!videoId) return;
    postHistory({
      channelId,
      videoId,
      positionSeconds: getPosition(),
      event: "seen",
    });
  }, [channelId, videoId, getPosition]);

  /** Caller invokes on manual skip (prev/next button). */
  const commitSkip = useCallback(() => {
    if (!videoId) return;
    postHistory({
      channelId,
      videoId,
      positionSeconds: getPosition(),
      event: "skip",
    });
  }, [channelId, videoId, getPosition]);

  return { commitSeen, commitSkip };
}
