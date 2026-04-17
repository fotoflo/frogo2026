"use client";

interface NumberPadProps {
  sendCommand: (command: string) => void;
}

export default function NumberPad({ sendCommand }: NumberPadProps) {
  return (
    <div className="px-6 pb-8 pt-4 relative z-10" role="group" aria-label="Direct tune">
      <div className="flex items-center gap-4 mb-4 px-2" aria-hidden="true">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[10px] text-white/15 font-mono tracking-wider">DIRECT TUNE</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => sendCommand(`channel_${n}`)}
            onTouchEnd={(e) => { e.preventDefault(); sendCommand(`channel_${n}`); }}
            aria-label={`Channel ${n}`}
            className="remote-btn py-5 rounded-2xl text-xl font-mono text-white/70 touch-manipulation relative overflow-hidden group"
          >
            <span className="relative z-10" aria-hidden="true">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
