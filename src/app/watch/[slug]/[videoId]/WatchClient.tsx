"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import YouTubePlayer from "@/components/YouTubePlayer";
import PairingDisplay from "@/components/PairingDisplay";
import { supabase } from "@/lib/supabase";

interface WatchClientProps {
  channel: any;
  video: any;
  playlist: any[];
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WatchClient({
  channel,
  video,
  playlist,
}: WatchClientProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const playerRef = useRef<any>(null);
  const lastCommandAtRef = useRef<string | null>(null);

  // Create pairing session on mount
  useEffect(() => {
    fetch("/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        setPairingCode(data.code);
        setSessionId(data.sessionId);
      });
  }, [video.id]);

  // Handle incoming commands from the remote
  const handleCommand = useCallback(
    (command: string) => {
      if (!playerRef.current) return;
      const player = playerRef.current;

      switch (command) {
        case "play":
          player.playVideo();
          break;
        case "pause":
          player.pauseVideo();
          break;
        case "next": {
          const currentIdx = playlist.findIndex((v) => v.id === video.id);
          const next = playlist[currentIdx + 1];
          if (next) {
            window.location.href = `/watch/${channel.slug}/${next.id}`;
          }
          break;
        }
        case "prev": {
          const currentIdx2 = playlist.findIndex((v) => v.id === video.id);
          const prev = playlist[currentIdx2 - 1];
          if (prev) {
            window.location.href = `/watch/${channel.slug}/${prev.id}`;
          }
          break;
        }
      }
    },
    [playlist, video.id, channel.slug]
  );

  // Subscribe to Supabase Realtime changes on the pairing_session row
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`pairing:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pairing_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const newRow = payload.new as any;

          // Detect pairing
          if (newRow.paired && !paired) {
            setPaired(true);
          }

          // Handle discrete commands via last_command + last_command_at
          if (
            newRow.last_command &&
            newRow.last_command_at &&
            newRow.last_command_at !== lastCommandAtRef.current
          ) {
            lastCommandAtRef.current = newRow.last_command_at;
            handleCommand(newRow.last_command);
          }

          // Handle playback state changes (play/pause set directly)
          if (newRow.playback_state === "playing") {
            playerRef.current?.playVideo();
          } else if (newRow.playback_state === "paused") {
            playerRef.current?.pauseVideo();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, paired, handleCommand]);

  const handleReady = useCallback((player: any) => {
    playerRef.current = player;
  }, []);

  const currentIdx = playlist.findIndex((v: any) => v.id === video.id);
  const nextVideo = playlist[currentIdx + 1];
  const prevVideo = playlist[currentIdx - 1];

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <Link
        href={`/channel/${channel.slug}`}
        className="text-sm text-muted hover:text-foreground transition-colors mb-4 inline-block"
      >
        &larr; {channel.icon} {channel.name}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main player area */}
        <div>
          <YouTubePlayer videoId={video.youtube_id} onReady={handleReady} />

          <div className="mt-4">
            <h1 className="text-xl font-semibold">{video.title}</h1>
            <p className="text-sm text-muted mt-2">{video.description}</p>
          </div>

          {/* Prev/Next controls */}
          <div className="flex gap-3 mt-4">
            {prevVideo && (
              <Link
                href={`/watch/${channel.slug}/${prevVideo.id}`}
                className="flex-1 rounded-lg border border-card-border bg-card-bg p-3 hover:border-accent/50 transition-colors text-sm"
              >
                <span className="text-xs text-muted">Previous</span>
                <div className="font-medium truncate">{prevVideo.title}</div>
              </Link>
            )}
            {nextVideo && (
              <Link
                href={`/watch/${channel.slug}/${nextVideo.id}`}
                className="flex-1 rounded-lg border border-card-border bg-card-bg p-3 hover:border-accent/50 transition-colors text-sm text-right"
              >
                <span className="text-xs text-muted">Up Next</span>
                <div className="font-medium truncate">{nextVideo.title}</div>
              </Link>
            )}
          </div>
        </div>

        {/* Sidebar: pairing + playlist */}
        <div className="space-y-4">
          {pairingCode && sessionId && (
            <PairingDisplay sessionId={sessionId} code={pairingCode} />
          )}
          {paired && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center text-sm text-green-400">
              Phone connected as remote
            </div>
          )}

          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <h3 className="text-sm font-medium text-muted mb-3">
              Playlist ({playlist.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {playlist.map((v: any) => (
                <Link
                  key={v.id}
                  href={`/watch/${channel.slug}/${v.id}`}
                  className={`flex gap-2 rounded-md p-2 text-xs transition-colors ${
                    v.id === video.id
                      ? "bg-accent/10 border border-accent/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="relative shrink-0 w-20 h-12 rounded overflow-hidden bg-black">
                    <Image
                      src={v.thumbnail_url}
                      alt={v.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium line-clamp-2">{v.title}</div>
                    <div className="text-muted mt-0.5">
                      {formatDuration(v.duration_seconds)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
