"use client";

interface FavoriteChannel {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

interface FavoritesListProps {
  favorites: FavoriteChannel[];
  loading: boolean;
  sendCommand: (command: string) => void;
  onClose: () => void;
}

export default function FavoritesList({ favorites, loading, sendCommand, onClose }: FavoritesListProps) {
  if (loading) {
    return (
      <div className="px-5 pb-4 relative z-10">
        <div className="text-center text-white/30 text-xs py-8">Loading favorites...</div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-4 relative z-10 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-white/60">Favorites</h2>
        <button onClick={onClose} className="text-xs text-white/30 hover:text-white/60">Close</button>
      </div>
      {favorites.length === 0 ? (
        <div className="text-center text-white/20 text-xs py-8 bg-black/30 rounded-xl border border-white/5">
          No favorites yet. Star a channel to save it here.
        </div>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto space-y-0.5 rounded-xl bg-black/30 border border-white/5 p-1.5">
          {favorites.map((ch) => (
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
