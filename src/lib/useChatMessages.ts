"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  message: string;
  nickname: string | null;
  created_at: string;
}

/**
 * TV-side hook: subscribes to chat messages for a pairing session.
 * Keeps the last 20 messages, live-updates via Realtime.
 */
export function useChatMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Fetch initial messages
  useEffect(() => {
    if (!sessionId) return;
    supabase
      .from("chat_messages")
      .select("id, message, nickname, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setMessages(data.reverse());
      });
  }, [sessionId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => [...prev.slice(-19), msg]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  return messages;
}
