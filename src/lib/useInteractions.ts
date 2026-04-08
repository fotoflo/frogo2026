"use client";

import { useEffect, useRef, useCallback } from "react";

/** Fire-and-forget POST to an API route */
function post(url: string, body: Record<string, unknown>) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {}); // best-effort, don't block UI
}

/**
 * Hook that provides interaction tracking functions.
 * Initializes viewer cookie on mount via GET /api/viewer.
 */
export function useInteractions() {
  const initialized = useRef(false);

  // Ensure viewer cookie exists
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetch("/api/viewer").catch(() => {});
  }, []);

  const trackSeen = useCallback((videoId: string, channelId: string) => {
    post("/api/history", { videoId, channelId, event: "seen" });
  }, []);

  const trackSkip = useCallback((videoId: string, channelId: string) => {
    post("/api/history", { videoId, channelId, event: "skip" });
  }, []);

  const vote = useCallback((videoId: string, upvote: boolean) => {
    post("/api/vote", { videoId, upvote });
  }, []);

  const trackEvent = useCallback((event: string, payload?: Record<string, unknown>) => {
    post("/api/events", { event, payload });
  }, []);

  return { trackSeen, trackSkip, vote, trackEvent };
}
