"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PairingState {
  pairingCode: string | null;
  sessionId: string | null;
  paired: boolean;
}

/**
 * Creates a pairing session once per mount and subscribes to Realtime
 * updates. When the phone pairs, `paired` flips true. When the phone
 * sends a command, `onCommand` fires (dedup'd by last_command_at).
 */
export function usePairing(
  onCommand: (command: string) => void,
  initialVideoId?: string | null
): PairingState {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const lastCommandAtRef = useRef<string | null>(null);
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  });

  // Create session once on mount
  useEffect(() => {
    fetch("/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: initialVideoId ?? null }),
    })
      .then((r) => r.json())
      .then((data) => {
        setPairingCode(data.code);
        setSessionId(data.sessionId);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`pairing:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pairing_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as {
            paired?: boolean;
            last_command?: string;
            last_command_at?: string;
          };
          if (row.paired) setPaired(true);
          if (
            row.last_command &&
            row.last_command_at &&
            row.last_command_at !== lastCommandAtRef.current
          ) {
            lastCommandAtRef.current = row.last_command_at;
            onCommandRef.current(row.last_command);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId]);

  return { pairingCode, sessionId, paired };
}
