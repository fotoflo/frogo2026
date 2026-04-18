"use client";

import type { Channel } from "./types";

interface Props {
  query: string;
  siblings: Channel[];
  allChannels: Channel[];
  activeChannelId: string;
  onSwitchChannel: (channelId: string) => void;
}

function matches(ch: Channel, q: string): boolean {
  const qLower = q.toLowerCase();
  return (
    ch.name.toLowerCase().includes(qLower) ||
    ch.slug.toLowerCase().includes(qLower)
  );
}

function Tile({
  ch,
  isActive,
  onClick,
}: {
  ch: Channel;
  isActive: boolean;
  onClick: () => void;
}) {
  const firstVideo = ch.videos[0];
  const thumbUrl =
    firstVideo?.thumbnail_url ||
    (firstVideo && `https://img.youtube.com/vi/${firstVideo.youtube_id}/mqdefault.jpg`) ||
    "";
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className="group flex flex-col text-left active:scale-[0.98] transition-transform"
    >
      <div
        className={`aspect-video bg-black/50 relative rounded-md overflow-hidden ${
          isActive ? "ring-2 ring-accent" : "ring-1 ring-white/5"
        }`}
      >
        {thumbUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumbUrl} alt="" aria-hidden="true" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl opacity-50">
            {ch.icon}
          </div>
        )}
        {isActive && (
          <>
            <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 text-black text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider">
              PLAYING
            </div>
          </>
        )}
      </div>
      <div
        className={`mt-1.5 text-[12px] leading-tight line-clamp-2 min-[1600px]:text-sm ${
          isActive ? "text-accent font-semibold" : "text-white/80"
        }`}
      >
        {ch.icon} {ch.name}
      </div>
    </button>
  );
}

/**
 * Two-section channel search results. "In this directory" filters the
 * current scope's siblings; "Everywhere else" filters the remainder.
 * Shown in place of Directory+ChannelGrid when the HUD search box is
 * non-empty.
 */
export default function SearchResults({
  query,
  siblings,
  allChannels,
  activeChannelId,
  onSwitchChannel,
}: Props) {
  const q = query.trim();
  if (!q) return null;

  const siblingIds = new Set(siblings.map((c) => c.id));
  const local = siblings.filter((c) => matches(c, q));
  const elsewhere = allChannels.filter(
    (c) => !siblingIds.has(c.id) && matches(c, q)
  );

  const nothing = local.length === 0 && elsewhere.length === 0;

  return (
    <div className="flex-1 overflow-y-auto p-3 min-[1600px]:p-4 min-[2000px]:p-5">
      {nothing && (
        <div className="text-white/40 text-sm py-8 text-center">
          No channels match &ldquo;{q}&rdquo;
        </div>
      )}

      {local.length > 0 && (
        <section className="mb-5">
          <h3 className="text-[10px] font-semibold text-white/40 pb-2 tracking-[0.12em] uppercase min-[1600px]:text-xs">
            In this directory
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 pointer-coarse:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] pointer-coarse:gap-4 min-[1600px]:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] min-[1600px]:gap-4 min-[2000px]:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] min-[2000px]:gap-5">
            {local.map((ch) => (
              <Tile
                key={ch.id}
                ch={ch}
                isActive={ch.id === activeChannelId}
                onClick={() => onSwitchChannel(ch.id)}
              />
            ))}
          </div>
        </section>
      )}

      {elsewhere.length > 0 && (
        <section>
          <h3 className="text-[10px] font-semibold text-white/40 pb-2 tracking-[0.12em] uppercase min-[1600px]:text-xs">
            Everywhere else
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 pointer-coarse:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] pointer-coarse:gap-4 min-[1600px]:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] min-[1600px]:gap-4 min-[2000px]:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] min-[2000px]:gap-5">
            {elsewhere.map((ch) => (
              <Tile
                key={ch.id}
                ch={ch}
                isActive={ch.id === activeChannelId}
                onClick={() => onSwitchChannel(ch.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
