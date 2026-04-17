"use client";

interface VolumeRockerProps {
  sendCommand: (command: string) => void;
}

export default function VolumeRocker({ sendCommand }: VolumeRockerProps) {
  return (
    <div className="flex flex-col items-center gap-2" role="group" aria-label="Volume control">
      <button
        onClick={() => sendCommand("volume_up")}
        onTouchEnd={(e) => { e.preventDefault(); sendCommand("volume_up"); }}
        aria-label="Volume up"
        className="rocker-btn w-full py-6 rounded-t-[20px] rounded-b-lg flex flex-col items-center gap-0.5 touch-manipulation"
      >
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="text-white/60" aria-hidden="true">
          <path d="M10 1L19 11H1L10 1Z" fill="currentColor" />
        </svg>
        <span className="text-[10px] font-medium text-white/30 tracking-widest uppercase">VOL +</span>
      </button>

      <button
        onClick={() => sendCommand("mute_toggle")}
        onTouchEnd={(e) => { e.preventDefault(); sendCommand("mute_toggle"); }}
        aria-label="Toggle mute"
        className="remote-btn w-full py-3 rounded-xl flex items-center justify-center touch-manipulation"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/50" aria-hidden="true">
          <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <button
        onClick={() => sendCommand("volume_down")}
        onTouchEnd={(e) => { e.preventDefault(); sendCommand("volume_down"); }}
        aria-label="Volume down"
        className="rocker-btn w-full py-6 rounded-b-[20px] rounded-t-lg flex flex-col items-center gap-0.5 touch-manipulation"
      >
        <span className="text-[10px] font-medium text-white/30 tracking-widest uppercase">VOL -</span>
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="text-white/60" aria-hidden="true">
          <path d="M10 11L1 1H19L10 11Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
