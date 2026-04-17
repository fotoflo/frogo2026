"use client";

interface BentoGridProps {
  activePanel: "browse" | "favorites" | "recent" | "search" | null;
  onTogglePanel: (panel: "browse" | "favorites" | "recent" | "search") => void;
}

const tiles: { id: "search" | "browse" | "favorites" | "recent"; icon: string; label: string }[] = [
  { id: "search", icon: "search", label: "Search" },
  { id: "browse", icon: "grid_view", label: "Browse" },
  { id: "favorites", icon: "star", label: "Favorites" },
  { id: "recent", icon: "history", label: "Recent" },
];

export default function BentoGrid({ activePanel, onTogglePanel }: BentoGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((tile) => {
        const active = activePanel === tile.id;
        return (
          <button key={tile.id} onClick={() => onTogglePanel(tile.id)}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all touch-manipulation active:scale-95"
            style={{
              background: active ? "rgba(203,255,114,0.1)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? "rgba(203,255,114,0.3)" : "rgba(255,255,255,0.06)"}`,
              boxShadow: active ? "0 0 16px rgba(203,255,114,0.08)" : "none",
            }}>
            <span className="material-symbols-outlined text-xl"
              style={{ color: active ? "#cbff72" : "rgba(255,255,255,0.4)" }}>
              {tile.icon}
            </span>
            <span className="text-[10px] font-medium tracking-wider uppercase"
              style={{ color: active ? "#cbff72" : "rgba(255,255,255,0.35)" }}>
              {tile.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
