"use client";

interface TransportBarProps {
  sendCommand: (command: string) => void;
}

export default function TransportBar({ sendCommand }: TransportBarProps) {
  const btn = "remote-btn px-6 py-3 rounded-xl touch-manipulation text-white/50 active:text-white/80";

  return (
    <div className="flex items-center justify-center gap-6 px-6 py-3 relative z-10" role="group" aria-label="Video transport">
      <button
        onClick={() => sendCommand("video_prev")}
        onTouchEnd={(e) => { e.preventDefault(); sendCommand("video_prev"); }}
        aria-label="Previous video"
        className={btn}
      >
        <svg width="20" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19 20L9 12l10-8v16z" />
          <rect x="5" y="4" width="2" height="16" />
        </svg>
      </button>

      <button
        onClick={() => sendCommand("play_pause")}
        onTouchEnd={(e) => { e.preventDefault(); sendCommand("play_pause"); }}
        aria-label="Play or pause"
        className={`${btn} text-white/70`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <button
        onClick={() => sendCommand("video_next")}
        onTouchEnd={(e) => { e.preventDefault(); sendCommand("video_next"); }}
        aria-label="Next video"
        className={btn}
      >
        <svg width="20" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M5 4l10 8-10 8V4z" />
          <rect x="17" y="4" width="2" height="16" />
        </svg>
      </button>
    </div>
  );
}
