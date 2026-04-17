"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/useChatMessages";

interface ChatOverlayProps {
  messages: ChatMessage[];
}

export default function ChatOverlay({ messages }: ChatOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) return null;

  // Only show last 8 messages on screen
  const visible = messages.slice(-8);

  return (
    <div className="absolute bottom-[12%] left-4 z-[190] pointer-events-none w-[350px] max-w-[40vw]">
      <div ref={containerRef} className="flex flex-col gap-1">
        {visible.map((msg, i) => {
          // Fade older messages
          const opacity = 0.4 + (i / visible.length) * 0.6;
          return (
            <div
              key={msg.id}
              className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1.5 animate-slide-up"
              style={{ opacity }}
            >
              <span className="text-[10px] text-accent/70 font-medium mr-1.5">
                {msg.nickname || "Viewer"}
              </span>
              <span className="text-xs text-white/80">{msg.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
