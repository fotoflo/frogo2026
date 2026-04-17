"use client";

import Image from "next/image";
import Link from "next/link";

type PanelName = "guide" | "browse" | "favorites" | "recent";

interface RemoteHeaderProps {
  connected: boolean;
  showSearch: boolean;
  activePanel: PanelName | null;
  onToggleSearch: () => void;
  onTogglePanel: (panel: PanelName) => void;
  onUnpair: () => void;
}

export default function RemoteHeader({
  connected, showSearch, activePanel,
  onToggleSearch, onTogglePanel, onUnpair,
}: RemoteHeaderProps) {
  const btnBase = "px-2.5 py-1.5 rounded-lg text-[11px] transition-all touch-manipulation";
  const btnFor = (panel: PanelName) =>
    activePanel === panel ? `${btnBase} text-accent bg-accent/10` : `${btnBase} text-white/50 hover:text-white/80 hover:bg-white/5`;

  return (
    <div className="px-4 py-3 relative z-10">
      {/* Top row: logo + connection + unpair */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Image src="/images/frogo/frogo-logo-200.png" alt="Frogo" width={24} height={24} className="opacity-80" />
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-yellow-500"} animate-pulse`} />
            <span className="text-[10px] text-white/40">{connected ? "Live" : "..."}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/mobile" className={`${btnBase} text-white/50 hover:text-white/80 hover:bg-white/5`}>Watch</Link>
          <button onClick={onUnpair} className={`${btnBase} text-red-400/60 hover:text-red-400 hover:bg-red-400/5`}>Unpair</button>
        </div>
      </div>
      {/* Nav row */}
      <div className="flex items-center gap-1 overflow-x-auto">
        <button onClick={onToggleSearch} className={showSearch ? `${btnBase} text-accent bg-accent/10` : `${btnBase} text-white/50 hover:text-white/80 hover:bg-white/5`}>
          Search
        </button>
        <button onClick={() => onTogglePanel("guide")} className={btnFor("guide")}>Guide</button>
        <button onClick={() => onTogglePanel("browse")} className={btnFor("browse")}>Browse</button>
        <button onClick={() => onTogglePanel("favorites")} className={btnFor("favorites")}>Favs</button>
        <button onClick={() => onTogglePanel("recent")} className={btnFor("recent")}>Recent</button>
      </div>
    </div>
  );
}
