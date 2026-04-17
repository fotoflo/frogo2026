"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Fetches the set of seen video IDs for a channel on mount.
 * Returns a Set for O(1) lookups and a `markSeen` helper
 * to optimistically add IDs without re-fetching.
 */
export function useWatchHistory(channelId: string) {
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/history?channelId=${channelId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.seen) return;
        setSeenIds(new Set(Object.keys(data.seen)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const markSeen = useCallback((videoId: string) => {
    setSeenIds((prev) => {
      if (prev.has(videoId)) return prev;
      const next = new Set(prev);
      next.add(videoId);
      return next;
    });
  }, []);

  return { seenIds, markSeen };
}
