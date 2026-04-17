"use client";

import { useEffect, useState } from "react";

interface RecentChannel {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

interface RecentChannelsProps {
  sendCommand: (command: string) => void;
  onClose: () => void;
}

export default function RecentChannels({ sendCommand, onClose }: RecentChannelsProps) {
  const [channels, setChannels] = useState<RecentChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history/recent")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.recent ?? [])
          .map((r: { channels: RecentChannel }) => r.channels)
          .filter(Boolean);
        setChannels(list);
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

  return (
    <div className="px-5 pb-4 relative z-10 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-white/60">Recently Watched</h2>
        <button onClick={onClose} className="text-xs text-white/30 hover:text-white/60">Close</button>
      </div>
      {channels.length === 0 ? (
        <div className="text-center text-white/20 text-xs py-8 bg-black/30 rounded-xl border border-white/5">
          No watch history yet.
        </div>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto space-y-0.5 rounded-xl bg-black/30 border border-white/5 p-1.5">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => { sendCommand(`navigate_${ch.id}`); onClose(); }}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <span className="text-lg shrink-0">{ch.icon || "📺"}</span>
              <div className="text-xs font-medium text-white/80 truncate">{ch.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
