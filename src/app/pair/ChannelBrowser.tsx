"use client";

import { useEffect, useState } from "react";
import { whatsOnNow } from "@/lib/schedule";

interface BrowseChannel {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parent_id: string | null;
}

interface BrowseVideo {
  id: string;
  channel_id: string;
  title: string;
  duration_seconds: number;
}

interface ChannelBrowserProps {
  sendCommand: (command: string) => void;
  onClose: () => void;
}

export default function ChannelBrowser({ sendCommand, onClose }: ChannelBrowserProps) {
  const [channels, setChannels] = useState<BrowseChannel[]>([]);
  const [videosByChannel, setVideosByChannel] = useState<Record<string, BrowseVideo[]>>({});
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/channels/guide")
      .then((r) => r.json())
      .then((data) => {
        setChannels(data.channels ?? []);
        setVideosByChannel(data.videosByChannel ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-5 pb-4 relative z-10">
        <div className="text-center text-white/30 text-xs py-8">Loading...</div>
      </div>
    );
  }

  const siblings = channels.filter((c) => c.parent_id === scopeId);
  const hasChildren = (id: string) => channels.some((c) => c.parent_id === id);
  const scopeChannel = scopeId ? channels.find((c) => c.id === scopeId) : null;

  // Build breadcrumb
  const breadcrumbs: BrowseChannel[] = [];
  let walk = scopeChannel;
  while (walk) {
    breadcrumbs.unshift(walk);
    walk = walk.parent_id ? channels.find((c) => c.id === walk!.parent_id) : undefined;
  }

  function getNowPlaying(channelId: string): string {
    const vids = videosByChannel[channelId];
    if (!vids || vids.length === 0) return "";
    const durations = vids.map((v) => v.duration_seconds);
    const { index } = whatsOnNow(durations);
    return vids[index]?.title ?? "";
  }

  return (
    <div className="px-5 pb-4 relative z-10 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-white/60">Browse</h2>
        <button onClick={onClose} className="text-xs text-white/30 hover:text-white/60">Close</button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-3 text-[10px] text-white/30 flex-wrap">
        <button onClick={() => setScopeId(null)} className="hover:text-white/60">Home</button>
        {breadcrumbs.map((bc) => (
          <span key={bc.id} className="flex items-center gap-1">
            <span>/</span>
            <button onClick={() => setScopeId(bc.id)} className="hover:text-white/60">{bc.icon} {bc.name}</button>
          </span>
        ))}
      </div>

      <div className="max-h-[55vh] overflow-y-auto space-y-0.5 rounded-xl bg-black/30 border border-white/5 p-1.5">
        {siblings.length === 0 && (
          <div className="text-center text-white/20 text-xs py-6">No channels here</div>
        )}
        {siblings.map((ch) => {
          const isFolder = hasChildren(ch.id);
          const vids = videosByChannel[ch.id];
          const hasVideos = vids && vids.length > 0;
          const nowPlaying = getNowPlaying(ch.id);

          return (
            <button
              key={ch.id}
              onClick={() => {
                if (isFolder) {
                  setScopeId(ch.id);
                } else if (hasVideos) {
                  sendCommand(`navigate_${ch.id}`);
                  onClose();
                }
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <span className="text-lg shrink-0">{ch.icon || "📺"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white/80 truncate">{ch.name}</div>
                {nowPlaying && (
                  <div className="text-[10px] text-white/30 truncate mt-0.5">{nowPlaying}</div>
                )}
              </div>
              {isFolder && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white/20 shrink-0" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
