"use client";

import type { Channel } from "./types";

interface Props {
  ancestors: Channel[];
  siblings: Channel[];
  allChannels: Channel[];
  onNavigateToScope: (channelId: string | null) => void;
  onSwitchChannel: (channelId: string) => void;
}

const ITEM_BASE =
  "w-full text-left py-1.5 text-[13px] flex items-center gap-1.5 transition-colors min-[1600px]:py-2 min-[1600px]:text-sm min-[2000px]:text-base";

export default function Directory({
  ancestors,
  siblings,
  allChannels,
  onNavigateToScope,
  onSwitchChannel,
}: Props) {
  const subFolders = siblings.filter((s) =>
    allChannels.some((c) => c.parent_id === s.id)
  );

  return (
    <div className="hud-left-panel min-[1600px]:w-[220px] min-[2000px]:w-[260px]">
      <h3 className="text-[10px] font-semibold text-white/40 px-3 pt-2.5 pb-1.5 tracking-[0.12em] uppercase min-[1600px]:text-xs min-[1600px]:px-4 min-[2000px]:text-sm">
        Directory
      </h3>
      <div
        className="hud-scroll flex-1 overflow-y-auto pb-2"
        role="group"
        aria-label="Directory navigation"
      >
        <button
          onClick={() => onNavigateToScope(null)}
          aria-pressed={ancestors.length === 0}
          className={`${ITEM_BASE} px-3 min-[1600px]:px-4 ${
            ancestors.length === 0
              ? "text-accent font-bold bg-white/[0.04]"
              : "text-white/55 hover:text-white/90 hover:bg-white/[0.03]"
          }`}
        >
          <span aria-hidden="true">🏠</span>
          <span className="truncate">Home</span>
        </button>
        {ancestors.map((a, i) => {
          const isDeepest = i === ancestors.length - 1;
          return (
            <button
              key={a.id}
              onClick={() => onNavigateToScope(a.id)}
              aria-pressed={isDeepest}
              className={`${ITEM_BASE} truncate ${
                isDeepest
                  ? "text-accent font-bold bg-white/[0.04]"
                  : "text-white/55 hover:text-white/90 hover:bg-white/[0.03]"
              }`}
              style={{
                paddingLeft: `${12 + (i + 1) * 10}px`,
                paddingRight: "12px",
              }}
            >
              <span aria-hidden="true">{a.icon}</span>
              <span className="truncate">{a.name}</span>
            </button>
          );
        })}
        {subFolders.map((f) => {
          const depth = ancestors.length + 1;
          return (
            <button
              key={f.id}
              onClick={() => onSwitchChannel(f.id)}
              className={`${ITEM_BASE} truncate text-white/45 hover:text-white/90 hover:bg-white/[0.03]`}
              style={{
                paddingLeft: `${12 + depth * 10}px`,
                paddingRight: "12px",
              }}
            >
              <span aria-hidden="true">📁</span>
              <span className="truncate">{f.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
