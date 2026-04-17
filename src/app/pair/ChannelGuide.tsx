"use client";

import { useEffect, useState } from "react";
import { whatsOnNow } from "@/lib/schedule";

interface GuideChannel {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parent_id: string | null;
  position: number | null;
}

interface GuideVideo {
  id: string;
  channel_id: string;
  title: string;
  duration_seconds: number;
  thumbnail_url: string;
  position: number;
}

interface ChannelGuideProps {
  currentChannelId: string | null;
  sendCommand: (command: string) => void;
  onClose: () => void;
}

export default function ChannelGuide({ currentChannelId, sendCommand, onClose }: ChannelGuideProps) {
  const [channels, setChannels] = useState<GuideChannel[]>([]);
  const [videosByChannel, setVideosByChannel] = useState<Record<string, GuideVideo[]>>({});
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
        <div className="text-center text-white/30 text-xs py-8">Loading guide...</div>
      </div>
    );
  }

  // Group channels: top-level parents first, then their children
  const topLevel = channels.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) => channels.filter((c) => c.parent_id === parentId);

  function getNowPlaying(channelId: string): string {
    const vids = videosByChannel[channelId];
    if (!vids || vids.length === 0) return "No videos";
    const durations = vids.map((v) => v.duration_seconds);
    const { index } = whatsOnNow(durations);
    return vids[index]?.title ?? "Unknown";
  }

  function ChannelRow({ ch, indent = false }: { ch: GuideChannel; indent?: boolean }) {
    const isCurrent = ch.id === currentChannelId;
    const vids = videosByChannel[ch.id];
    const hasVideos = vids && vids.length > 0;

    return (
      <button
        key={ch.id}
        onClick={() => { if (hasVideos) { sendCommand(`navigate_${ch.id}`); onClose(); } }}
        disabled={!hasVideos}
        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
          isCurrent ? "bg-accent/15 border border-accent/30" : "hover:bg-white/5 active:bg-white/10"
        } ${!hasVideos ? "opacity-40" : ""} ${indent ? "ml-4" : ""}`}
      >
        <span className="text-lg shrink-0">{ch.icon || "📺"}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white/80 truncate">{ch.name}</div>
          <div className="text-[10px] text-white/30 truncate mt-0.5">
            {hasVideos ? getNowPlaying(ch.id) : "Empty channel"}
          </div>
        </div>
        {isCurrent && (
          <span className="text-[9px] text-accent font-mono tracking-wider shrink-0">LIVE</span>
        )}
      </button>
    );
  }

  return (
    <div className="px-5 pb-4 relative z-10 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-white/60">Channel Guide</h2>
        <button onClick={onClose} className="text-xs text-white/30 hover:text-white/60">Close</button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto space-y-0.5 rounded-xl bg-black/30 border border-white/5 p-1.5">
        {topLevel.map((parent) => {
          const children = childrenOf(parent.id);
          return (
            <div key={parent.id}>
              <ChannelRow ch={parent} />
              {children.map((child) => (
                <ChannelRow key={child.id} ch={child} indent />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
