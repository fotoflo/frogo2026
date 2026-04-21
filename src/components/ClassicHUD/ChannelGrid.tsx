"use client";

import type { Channel } from "./types";

interface Props {
  channel: Channel;
  siblings: Channel[];
  allChannels: Channel[];
  onSwitchChannel: (channelId: string) => void;
  onNavigateToScope: (channelId: string) => void;
}

export default function ChannelGrid({
  channel,
  siblings,
  allChannels,
  onSwitchChannel,
  onNavigateToScope,
}: Props) {
  return (
    <div className="hud-right-panel">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-3 pointer-coarse:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] pointer-coarse:gap-4 pointer-coarse:p-4 min-[1600px]:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] min-[1600px]:gap-4 min-[1600px]:p-4 min-[2000px]:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] min-[2000px]:gap-5 min-[2000px]:p-5">
        {siblings
          .filter((ch) =>
            ch.videos.length > 0 ||
            allChannels.some((c) => c.parent_id === ch.id && c.videos.length > 0)
          )
          .map((ch, i) => {
          const isPlaying = ch.id === channel.id;
          const firstVideo =
            ch.videos[0] ??
            allChannels.find((c) => c.parent_id === ch.id && c.videos.length > 0)?.videos[0];
          const thumbUrl = firstVideo
            ? firstVideo.thumbnail_url ||
              `https://img.youtube.com/vi/${firstVideo.youtube_id}/mqdefault.jpg`
            : "";
          const isFolder = allChannels.some((c) => c.parent_id === ch.id);
          return (
            <button
              key={ch.id}
              onClick={() =>
                isFolder ? onNavigateToScope(ch.id) : onSwitchChannel(ch.id)
              }
              aria-label={
                isFolder
                  ? `Open ${ch.name} folder`
                  : `Switch to ${ch.name}${isPlaying ? " (currently playing)" : ""}`
              }
              aria-current={isPlaying ? "true" : undefined}
              className="hud-channel-tile group flex flex-col active:scale-[0.98] transition-transform"
            >
              <div
                className={`hud-channel-thumb aspect-video bg-black/50 relative rounded-md overflow-hidden ${
                  isPlaying ? "ring-2 ring-accent" : "ring-1 ring-white/5 pointer-coarse:ring-white/15 group-active:ring-white/40"
                }`}
              >
                {firstVideo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src.includes("maxresdefault")) {
                        img.src = `https://img.youtube.com/vi/${firstVideo.youtube_id}/hqdefault.jpg`;
                      } else if (img.src.includes("hqdefault")) {
                        img.src = `https://img.youtube.com/vi/${firstVideo.youtube_id}/mqdefault.jpg`;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl opacity-40">
                    {ch.icon}
                  </div>
                )}
                {isPlaying && (
                  <>
                    <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 text-black text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider min-[1600px]:text-xs min-[1600px]:px-2.5 min-[2000px]:text-sm"
                      aria-hidden="true"
                    >
                      PLAYING
                    </div>
                  </>
                )}
                <div
                  className="absolute top-1 left-1 text-[10px] font-mono text-white/80 bg-black/60 px-1 rounded min-[1600px]:text-xs min-[1600px]:px-1.5 min-[2000px]:text-sm"
                  aria-hidden="true"
                >
                  {i + 1}
                </div>
                {isFolder && (
                  <div
                    className="absolute top-1 right-1 text-[10px] text-white/80 bg-black/60 px-1 rounded min-[1600px]:text-xs min-[2000px]:text-sm"
                    aria-hidden="true"
                    title="Contains sub-channels"
                  >
                    📁
                  </div>
                )}
              </div>
              <div className="mt-1.5 px-0.5 min-[1600px]:mt-2">
                <div
                  className={`text-[12px] leading-tight line-clamp-2 min-[1600px]:text-sm min-[2000px]:text-base ${
                    isPlaying ? "text-accent font-semibold" : "text-white/80"
                  }`}
                >
                  {ch.icon} {ch.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
