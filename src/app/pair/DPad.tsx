"use client";

interface DPadProps {
  sendCommand: (command: string) => void;
  isPlaying: boolean;
}

export default function DPad({ sendCommand, isPlaying }: DPadProps) {
  const arrow = "absolute flex items-center justify-center text-white/40 hover:text-white/70 active:text-[#cbff72] transition-colors touch-manipulation";

  return (
    <div className="flex items-center justify-center gap-4">
      {/* VOL rocker */}
      <div className="flex flex-col gap-1 items-center">
        <span className="text-[9px] uppercase font-bold tracking-[0.15em] text-neutral-600 mb-1">Vol</span>
        <button onClick={() => sendCommand("volume_up")}
          className="w-12 h-14 rounded-t-2xl flex items-center justify-center text-white/50 hover:text-white/80 active:text-[#cbff72] transition-colors touch-manipulation"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          aria-label="Volume up">
          <span className="material-symbols-outlined text-lg">add</span>
        </button>
        <button onClick={() => sendCommand("volume_down")}
          className="w-12 h-14 rounded-b-2xl flex items-center justify-center text-white/50 hover:text-white/80 active:text-[#cbff72] transition-colors touch-manipulation"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none" }}
          aria-label="Volume down">
          <span className="material-symbols-outlined text-lg">remove</span>
        </button>
        <button onClick={() => sendCommand("mute_toggle")}
          className="mt-1 w-12 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 active:text-[#cbff72] transition-colors touch-manipulation text-[10px] uppercase tracking-wider"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          aria-label="Mute toggle">
          <span className="material-symbols-outlined text-sm">volume_off</span>
        </button>
      </div>

      {/* D-Pad disc */}
      <div className="relative w-48 h-48 rounded-full flex items-center justify-center"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 40px rgba(203,255,114,0.04), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
        {/* Up — prev channel */}
        <button onClick={() => sendCommand("prev")}
          className={`${arrow} top-3 left-1/2 -translate-x-1/2 w-12 h-12`}
          aria-label="Previous channel">
          <span className="material-symbols-outlined text-2xl">expand_less</span>
        </button>
        {/* Down — next channel */}
        <button onClick={() => sendCommand("next")}
          className={`${arrow} bottom-3 left-1/2 -translate-x-1/2 w-12 h-12`}
          aria-label="Next channel">
          <span className="material-symbols-outlined text-2xl">expand_more</span>
        </button>
        {/* Left — prev video */}
        <button onClick={() => sendCommand("video_prev")}
          className={`${arrow} left-3 top-1/2 -translate-y-1/2 w-12 h-12`}
          aria-label="Previous video">
          <span className="material-symbols-outlined text-2xl">chevron_left</span>
        </button>
        {/* Right — next video */}
        <button onClick={() => sendCommand("video_next")}
          className={`${arrow} right-3 top-1/2 -translate-y-1/2 w-12 h-12`}
          aria-label="Next video">
          <span className="material-symbols-outlined text-2xl">chevron_right</span>
        </button>
        {/* Center — play/pause */}
        <button onClick={() => sendCommand("play_pause")}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white hover:text-[#cbff72] active:scale-95 transition-all touch-manipulation"
          style={{ background: "rgba(203,255,114,0.1)", border: "1px solid rgba(203,255,114,0.25)", boxShadow: "0 0 20px rgba(203,255,114,0.08)" }}
          aria-label={isPlaying ? "Pause" : "Play"}>
          <span className="material-symbols-outlined text-3xl">
            {isPlaying ? "pause" : "play_arrow"}
          </span>
        </button>
      </div>

      {/* CH rocker */}
      <div className="flex flex-col gap-1 items-center">
        <span className="text-[9px] uppercase font-bold tracking-[0.15em] text-neutral-600 mb-1">Ch</span>
        <button onClick={() => sendCommand("prev")}
          className="w-12 h-14 rounded-t-2xl flex items-center justify-center text-white/50 hover:text-white/80 active:text-[#cbff72] transition-colors touch-manipulation"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          aria-label="Channel up">
          <span className="material-symbols-outlined text-lg">add</span>
        </button>
        <button onClick={() => sendCommand("next")}
          className="w-12 h-14 rounded-b-2xl flex items-center justify-center text-white/50 hover:text-white/80 active:text-[#cbff72] transition-colors touch-manipulation"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none" }}
          aria-label="Channel down">
          <span className="material-symbols-outlined text-lg">remove</span>
        </button>
      </div>
    </div>
  );
}
