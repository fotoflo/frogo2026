"use client";

interface OnScreenRemoteProps {
  channel: any;
  channelIdx: number;
  allChannels: any[];
  activeVideo: any;
  onSwitchChannel: (slug: string) => void;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  onClose: () => void;
  /** true when user clicked to expand, false when just mouse hover */
  expanded: boolean;
}

export default function OnScreenRemote({
  channel,
  channelIdx,
  allChannels,
  activeVideo,
  onSwitchChannel,
  onPrevChannel,
  onNextChannel,
  onClose,
  expanded,
}: OnScreenRemoteProps) {
  if (!expanded) {
    // Minimal floating remote — just channel up/down + info
    return (
      <div className="absolute bottom-8 right-8 flex flex-col items-center gap-1 transition-opacity">
        <button
          onClick={onPrevChannel}
          className="w-12 h-10 rounded-t-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white text-lg transition-colors"
        >
          ▲
        </button>
        <div className="w-12 h-10 flex items-center justify-center bg-white/10 backdrop-blur-sm text-white font-mono text-sm">
          {channelIdx + 1}
        </div>
        <button
          onClick={onNextChannel}
          className="w-12 h-10 rounded-b-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white text-lg transition-colors"
        >
          ▼
        </button>
      </div>
    );
  }

  // Expanded remote — full channel guide
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="w-96 max-h-[80vh] bg-zinc-900/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header with current channel */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Now watching</div>
          <div className="text-white font-medium">
            <span className="text-accent font-mono mr-2">{channelIdx + 1}</span>
            {channel.icon} {channel.name}
          </div>
          {activeVideo && (
            <div className="text-sm text-white/50 mt-0.5 truncate">{activeVideo.title}</div>
          )}
        </div>

        {/* Channel list */}
        <div className="overflow-y-auto max-h-[60vh]">
          {allChannels.map((ch: any, i: number) => (
            <button
              key={ch.id}
              onClick={() => onSwitchChannel(ch.slug)}
              className={`w-full text-left flex items-center gap-3 px-5 py-3 transition-colors ${
                ch.id === channel.id
                  ? "bg-accent/15 text-accent"
                  : "text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="font-mono text-sm w-6 text-center text-white/40">{i + 1}</span>
              <span className="text-lg">{ch.icon}</span>
              <span className="text-sm font-medium flex-1">{ch.name}</span>
              {ch.id === channel.id && (
                <span className="text-xs text-accent/60">ON AIR</span>
              )}
            </button>
          ))}
        </div>

        {/* Footer controls */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex gap-3">
            <button
              onClick={onPrevChannel}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              ▲ CH-
            </button>
            <button
              onClick={onNextChannel}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              ▼ CH+
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-sm transition-colors"
          >
            Close
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="px-5 py-2 border-t border-white/5 text-[10px] text-white/20 flex gap-4">
          <span><kbd className="text-white/40">Up/Down</kbd> switch</span>
          <span><kbd className="text-white/40">1-9</kbd> channel</span>
          <span><kbd className="text-white/40">F</kbd> fullscreen</span>
          <span><kbd className="text-white/40">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
