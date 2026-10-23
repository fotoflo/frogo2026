"use client";

import { useCallback, useEffect, useState } from "react";
import { getInitialAutoplayState, autoplayTransition } from "@/lib/autoplay";

type YTPlayer = {
  unMute?: () => void;
  setVolume?: (v: number) => void;
  isMuted?: () => boolean;
  getPlayerState?: () => number;
  playVideo?: () => void;
  pauseVideo?: () => void;
};

/**
 * Manages muted-autoplay unmute attempts and screen-click play/pause.
 * Always starts muted (browser policy); tries to unmute once player is
 * ready; unmutes on first user click regardless. While `hold` is true
 * (e.g. the onboarding overlay is up) the automatic unmute is deferred.
 */
export function useAutoplay(playerRef: React.RefObject<YTPlayer | null>, hold = false) {
  const [autoplay, setAutoplay] = useState(getInitialAutoplayState);

  const onPlayerReady = useCallback(() => {
    setAutoplay((s) => autoplayTransition(s, { type: "PLAYER_READY" }));
  }, []);

  useEffect(() => {
    if (hold || autoplay.state !== "muted" || !autoplay.shouldAttemptUnmute) return;
    const player = playerRef.current;
    if (!player) return;

    const timer = setTimeout(() => {
      try {
        player.unMute?.();
        player.setVolume?.(100);
        setTimeout(() => {
          if (player.isMuted?.()) {
            setAutoplay((s) => autoplayTransition(s, { type: "UNMUTE_ATTEMPT_FAILED" }));
          } else {
            setAutoplay((s) => autoplayTransition(s, { type: "UNMUTE_ATTEMPT_SUCCEEDED" }));
          }
        }, 200);
      } catch {
        setAutoplay((s) => autoplayTransition(s, { type: "UNMUTE_ATTEMPT_FAILED" }));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [hold, autoplay.state, autoplay.shouldAttemptUnmute, playerRef]);

  // Unmute from a user gesture without touching play/pause. Before the
  // player is ready this is a no-op; the deferred unmute attempt runs then.
  const unlockAudio = useCallback(() => {
    if (autoplay.state !== "muted") return;
    setAutoplay((s) => autoplayTransition(s, { type: "USER_INTERACTION" }));
    playerRef.current?.unMute?.();
    playerRef.current?.setVolume?.(100);
  }, [autoplay.state, playerRef]);

  const handleScreenClick = useCallback(() => {
    const player = playerRef.current;
    if (autoplay.state === "muted") {
      setAutoplay((s) => autoplayTransition(s, { type: "USER_INTERACTION" }));
      if (player) {
        player.unMute?.();
        player.setVolume?.(100);
        const state = player.getPlayerState?.();
        if (state !== 1 && state !== 3) player.playVideo?.();
      }
      return;
    }
    if (!player?.getPlayerState) return;
    const state = player.getPlayerState();
    if (state === 1) player.pauseVideo?.();
    else player.playVideo?.();
  }, [autoplay.state, playerRef]);

  return { autoplay, onPlayerReady, handleScreenClick, unlockAudio };
}
