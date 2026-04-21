"use client";

import { useEffect, useState } from "react";
import type { Reaction } from "@/lib/useReactions";

interface ReactionOverlayProps {
  reactions: Reaction[];
}

export default function ReactionOverlay({ reactions }: ReactionOverlayProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (reactions.length === 0) return;
    let raf: number;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reactions.length]);

  if (reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[200]">
      {reactions.map((r) => {
        const age = now - r.createdAt;
        const progress = Math.min(age / 2000, 1);
        const opacity = 1 - progress;
        const translateY = -120 * progress;
        const scale = 0.5 + 0.5 * Math.min(progress * 4, 1); // quick scale-up

        return (
          <div
            key={r.id}
            className="absolute bottom-[20%] text-4xl select-none"
            style={{
              left: `${r.x}%`,
              transform: `translateY(${translateY}px) scale(${scale})`,
              opacity,
              transition: "none",
            }}
          >
            {r.emoji}
          </div>
        );
      })}
    </div>
  );
}
