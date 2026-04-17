"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Periodically syncs TV playback state to the pairing_sessions row
 * so the phone remote can display what's currently playing.
 * Writes every 5 seconds when playing, plus on channel/video change.
 */
export function usePairingSync({
  sessionId,
  playerRef,
  channelId,
  videoId,
  isPlaying,
}: {
  sessionId: string | null;
  playerRef: React.RefObject<{ getCurrentTime?: () => number } | null>;
  channelId: string;
  videoId: string | null;
  isPlaying: boolean;
}) {
  const lastWriteRef = useRef<string>("");

  // Write state on channel/video change immediately
  useEffect(() => {
    if (!sessionId || !videoId) return;
    const state = {
      current_channel_id: channelId,
      current_video_id: videoId,
      playback_state: isPlaying ? "playing" : "paused",
      playback_position: playerRef.current?.getCurrentTime?.() ?? 0,
    };
    const key = `${channelId}:${videoId}`;
    if (key !== lastWriteRef.current) {
      lastWriteRef.current = key;
      supabase
        .from("pairing_sessions")
        .update(state)
        .eq("id", sessionId)
        .then(() => {});
    }
  }, [sessionId, channelId, videoId, isPlaying, playerRef]);

  // Periodic sync every 5s while playing
  useEffect(() => {
    if (!sessionId || !isPlaying) return;
    const interval = setInterval(() => {
      const pos = playerRef.current?.getCurrentTime?.() ?? 0;
      supabase
        .from("pairing_sessions")
        .update({
          playback_position: pos,
          playback_state: "playing",
        })
        .eq("id", sessionId)
        .then(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, isPlaying, playerRef]);
}
