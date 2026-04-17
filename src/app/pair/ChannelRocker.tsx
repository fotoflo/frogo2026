"use client";

interface ChannelRockerProps {
  sendCommand: (command: string) => void;
}

export default function ChannelRocker({ sendCommand }: ChannelRockerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 relative" role="group" aria-label="Channel rocker">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-accent/5 blur-[80px] pointer-events-none" aria-hidden="true" />

      <button
        onClick={() => sendCommand("prev")}
        onTouchEnd={(e) => { e.preventDefault(); sendCommand("prev"); }}
        aria-label="Previous channel"
        className="rocker-btn w-full max-w-[280px] py-8 rounded-t-[28px] rounded-b-xl flex flex-col items-center gap-1 touch-manipulation"
      >
        <svg width="28" height="16" viewBox="0 0 28 16" fill="none" className="text-white/60" aria-hidden="true">
          <path d="M14 2L26 14H2L14 2Z" fill="currentColor" />
        </svg>
        <span className="text-[11px] font-medium text-white/30 tracking-widest uppercase mt-1" aria-hidden="true">CH +</span>
      </button>

      <div className="w-full max-w-[280px] flex items-center gap-4 py-1" aria-hidden="true">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[10px] text-white/20 font-mono tracking-wider">CHANNEL</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      <button
        onClick={() => sendCommand("next")}
        onTouchEnd={(e) => { e.preventDefault(); sendCommand("next"); }}
        aria-label="Next channel"
        className="rocker-btn w-full max-w-[280px] py-8 rounded-b-[28px] rounded-t-xl flex flex-col items-center gap-1 touch-manipulation"
      >
        <span className="text-[11px] font-medium text-white/30 tracking-widest uppercase mb-1" aria-hidden="true">CH -</span>
        <svg width="28" height="16" viewBox="0 0 28 16" fill="none" className="text-white/60" aria-hidden="true">
          <path d="M14 14L2 2H26L14 14Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
