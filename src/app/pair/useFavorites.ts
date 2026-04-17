"use client";

import { useEffect, useState, useCallback } from "react";

interface FavoriteChannel {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((data) => {
        const channels = (data.favorites ?? [])
          .map((f: { channels: FavoriteChannel }) => f.channels)
          .filter(Boolean);
        setFavorites(channels);
      })
      .finally(() => setLoading(false));
  }, []);

  const isFavorite = useCallback(
    (channelId: string) => favorites.some((f) => f.id === channelId),
    [favorites]
  );

  const toggleFavorite = useCallback(async (channelId: string, channel?: FavoriteChannel) => {
    const removing = favorites.some((f) => f.id === channelId);

    // Optimistic update
    if (removing) {
      setFavorites((prev) => prev.filter((f) => f.id !== channelId));
    } else if (channel) {
      setFavorites((prev) => [channel, ...prev]);
    }

    const method = removing ? "DELETE" : "POST";
    await fetch("/api/favorites", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
  }, [favorites]);

  return { favorites, loading, isFavorite, toggleFavorite };
}
