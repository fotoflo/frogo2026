"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export interface Reaction {
  id: string;
  emoji: string;
  x: number; // 0-100 percentage
  createdAt: number;
}

/**
 * TV-side hook: listens to Supabase Realtime Broadcast for emoji reactions.
 * Returns a list of active reactions (auto-expire after TTL).
 */
export function useReactions(desktopSessionId: string | null) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const nextIdRef = useRef(0);

  // Clean up expired reactions
  useEffect(() => {
    if (reactions.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setReactions((prev) => prev.filter((r) => now - r.createdAt < 2000));
    }, 200);
    return () => clearInterval(interval);
  }, [reactions.length]);

  // Subscribe to broadcast channel
  useEffect(() => {
    if (!desktopSessionId) return;
    const ch = supabase.channel(`reactions:${desktopSessionId}`);

    ch.on("broadcast", { event: "reaction" }, (payload) => {
      const { emoji } = payload.payload as { emoji: string };
      const id = `r-${nextIdRef.current++}`;
      const x = 10 + Math.random() * 80; // random horizontal position
      setReactions((prev) => [...prev, { id, emoji, x, createdAt: Date.now() }]);
    });

    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [desktopSessionId]);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!desktopSessionId) return;
      supabase.channel(`reactions:${desktopSessionId}`).send({
        type: "broadcast",
        event: "reaction",
        payload: { emoji },
      });
    },
    [desktopSessionId]
  );

  return { reactions, sendReaction };
}
