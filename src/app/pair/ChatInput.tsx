"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface ChatInputProps {
  sessionId: string;
}

export default function ChatInput({ sessionId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setMessage("");

    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      message: text,
    });

    setSending(false);
  }

  return (
    <div className="flex items-center gap-2 px-4 pb-3 relative z-10">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 280))}
        onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
        placeholder="Say something..."
        className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/40 transition-all"
      />
      <button
        onClick={handleSend}
        disabled={!message.trim() || sending}
        className="px-4 py-2.5 rounded-xl bg-accent/80 hover:bg-accent disabled:opacity-30 text-white text-sm font-medium transition-all touch-manipulation"
      >
        Send
      </button>
    </div>
  );
}
