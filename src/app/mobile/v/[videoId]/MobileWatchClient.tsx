"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import YouTubePlayer from "@/components/YouTubePlayer";

interface Video {
  id: string;
  title: string;
  description?: string;
  youtube_id: string;
  thumbnail_url: string;
  made_for_kids?: boolean;
}

interface Channel {
  slug: string;
  name: string;
  icon?: string;
}

interface MobileWatchClientExtras {
  /** Prebuilt mobile channel href — parent chain resolved server-side. */
  channelPath: string;
}

interface YTPlayer {
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  destroy: () => void;
}

interface MobileWatchClientProps extends MobileWatchClientExtras {
  channel: Channel;
  video: Video;
  playlist: Video[];
}

export default function MobileWatchClient({
  channel,
  video,
  playlist,
  channelPath,
}: MobileWatchClientProps) {
  const playerRef = useRef<YTPlayer | null>(null);

  const handleReady = useCallback((player: YTPlayer) => {
    playerRef.current = player;
  }, []);

  const currentIdx = playlist.findIndex((v) => v.id === video.id);
  const nextVideo = playlist[currentIdx + 1];
  const prevVideo = playlist[currentIdx - 1];

  return (
    <div className="max-w-lg mx-auto">
      {/* Full-width player */}
      <div className="aspect-video w-full">
        <YouTubePlayer
          videoId={video.youtube_id}
          controls
          muted={false}
          madeForKids={video.made_for_kids}
          onReady={handleReady}
          onEnded={() => {
            if (nextVideo) {
              window.location.href = `/mobile/v/${nextVideo.id}`;
            }
          }}
        />
      </div>

      <div className="px-4 py-4">
        <Link
          href={channelPath}
          className="text-xs text-muted mb-2 inline-block"
        >
          &larr; {channel.icon} {channel.name}
        </Link>

        <h1 className="text-lg font-semibold mb-1">{video.title}</h1>
        <p className="text-xs text-muted mb-4">{video.description}</p>

        {/* Prev / Next */}
        <div className="flex gap-2 mb-6">
          {prevVideo ? (
            <Link
              href={`/mobile/v/${prevVideo.id}`}
              className="flex-1 rounded-lg border border-card-border bg-card-bg p-3 text-xs active:bg-accent/5"
            >
              <span className="text-muted">Previous</span>
              <div className="font-medium truncate mt-0.5">{prevVideo.title}</div>
            </Link>
          ) : <div className="flex-1" />}
          {nextVideo ? (
            <Link
              href={`/mobile/v/${nextVideo.id}`}
              className="flex-1 rounded-lg border border-card-border bg-card-bg p-3 text-xs text-right active:bg-accent/5"
            >
              <span className="text-muted">Up Next</span>
              <div className="font-medium truncate mt-0.5">{nextVideo.title}</div>
            </Link>
          ) : <div className="flex-1" />}
        </div>

        {/* Playlist */}
        <h3 className="text-sm font-medium text-muted mb-2">
          Up Next in {channel.name}
        </h3>
        <div className="space-y-2">
          {playlist
            .filter((v) => v.id !== video.id)
            .map((v) => (
              <Link
                key={v.id}
                href={`/mobile/v/${v.id}`}
                className="flex gap-2 rounded-lg p-2 active:bg-white/5 transition-colors"
              >
                <div className="relative shrink-0 w-24 h-14 rounded overflow-hidden bg-black">
                  <Image
                    src={v.thumbnail_url}
                    alt={v.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium line-clamp-2">{v.title}</div>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
