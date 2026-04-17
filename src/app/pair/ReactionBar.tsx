"use client";

import { supabase } from "@/lib/supabase";

const REACTIONS = ["❤️", "🔥", "😂", "😮", "👏", "🤯", "💀", "🎉"];

interface ReactionBarProps {
  desktopSessionId: string | null;
}

export default function ReactionBar({ desktopSessionId }: ReactionBarProps) {
  function sendReaction(emoji: string) {
    if (!desktopSessionId) return;
    supabase.channel(`reactions:${desktopSessionId}`).send({
      type: "broadcast",
      event: "reaction",
      payload: { emoji },
    });
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2 relative z-10" role="group" aria-label="Reactions">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => sendReaction(emoji)}
          onTouchEnd={(e) => { e.preventDefault(); sendReaction(emoji); }}
          className="text-xl active:scale-125 transition-transform touch-manipulation"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
