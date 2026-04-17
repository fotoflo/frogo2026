"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface VideoInfo {
  id: string;
  youtube_id: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
}

interface ChannelInfo {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parent_id: string | null;
}

export interface RemoteState {
  video: VideoInfo | null;
  channel: ChannelInfo | null;
  playbackState: "playing" | "paused" | "idle";
  playbackPosition: number;
  loading: boolean;
}

/**
 * Subscribes to the pairing session via Realtime and fetches
 * video/channel metadata when the TV changes what's playing.
 */
export function useRemoteState(sessionId: string | null): RemoteState {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [playbackState, setPlaybackState] = useState<"playing" | "paused" | "idle">("idle");
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastVideoIdRef = useRef<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/pair/state?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.video) setVideo(data.video);
      if (data.channel) setChannel(data.channel);
      setPlaybackState(data.playbackState ?? "idle");
      setPlaybackPosition(data.playbackPosition ?? 0);
      lastVideoIdRef.current = data.video?.id ?? null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Fetch on mount
  useEffect(() => { fetchState(); }, [fetchState]);

  // Subscribe to Realtime updates for position + video changes
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`remote-state:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pairing_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as {
            current_video_id?: string;
            playback_state?: string;
            playback_position?: number;
          };
          if (row.playback_position !== undefined) setPlaybackPosition(row.playback_position);
          if (row.playback_state) setPlaybackState(row.playback_state as "playing" | "paused" | "idle");
          // Re-fetch metadata if the video changed
          if (row.current_video_id && row.current_video_id !== lastVideoIdRef.current) {
            lastVideoIdRef.current = row.current_video_id;
            fetchState();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchState]);

  return { video, channel, playbackState, playbackPosition, loading };
}
