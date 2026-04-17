"use client";

interface SearchResultChannel {
  id?: string;
  slug?: string;
  icon?: string;
  name?: string;
}

interface SearchResult {
  id: string;
  title: string;
  channels?: SearchResultChannel;
}

interface SearchPanelProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: SearchResult[];
  sendCommand: (command: string) => void;
  onClose: () => void;
}

export default function SearchPanel({ searchQuery, onSearchChange, searchResults, sendCommand, onClose }: SearchPanelProps) {
  return (
    <div id="search-panel" className="px-5 pb-3 animate-slide-up relative z-10">
      <div className="relative">
        <label htmlFor="remote-search" className="sr-only">Search videos</label>
        <input
          id="remote-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search videos..."
          className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/40 transition-all"
          autoFocus
        />
      </div>
      {searchResults.length > 0 && (
        <ul className="mt-2 max-h-52 overflow-y-auto space-y-0.5 rounded-xl bg-black/40 border border-white/5 p-1" role="listbox" aria-label="Search results">
          {searchResults.map((v) => (
            <li key={v.id} role="option" aria-selected={false}>
              <button
                onClick={() => {
                  const ch = v.channels;
                  if (ch?.id) sendCommand(`navigate_${ch.id}`);
                  onClose();
                }}
                className="w-full text-left flex gap-3 p-3 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate text-white/80">{v.title}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">
                    {v.channels?.icon} {v.channels?.name}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
