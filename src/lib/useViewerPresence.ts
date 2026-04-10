"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface ViewerLocation {
  lat: number;
  lng: number;
  city: string;
  isYou?: boolean;
}

export function useViewerPresence(channelSlug: string) {
  const [viewers, setViewers] = useState<ViewerLocation[]>([]);
  const [myLocation, setMyLocation] = useState<ViewerLocation | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch geo on mount
  useEffect(() => {
    fetch("/api/geo")
      .then((r) => r.json())
      .then((geo: { lat: number; lng: number; city: string }) => {
        setMyLocation({ ...geo, isYou: true });
      })
      .catch(() => {
        // Fallback — still join presence without location
        setMyLocation({ lat: 40.7128, lng: -74.006, city: "Unknown", isYou: true });
      });
  }, []);

  // Join presence channel when we have location + slug
  useEffect(() => {
    if (!myLocation) return;

    const ch = supabase.channel(`viewers:${channelSlug}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ lat: number; lng: number; city: string }>();
      const all: ViewerLocation[] = [];
      for (const key of Object.keys(state)) {
        for (const presence of state[key]) {
          all.push({
            lat: presence.lat,
            lng: presence.lng,
            city: presence.city,
          });
        }
      }
      setViewers(all);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          lat: myLocation.lat,
          lng: myLocation.lng,
          city: myLocation.city,
        });
      }
    });

    channelRef.current = ch;

    return () => {
      ch.untrack();
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [channelSlug, myLocation]);

  return {
    viewers,
    myLocation,
    viewerCount: viewers.length,
  };
}
