/**
 * Check YouTube video availability via oEmbed (no API key needed).
 * Filters out videos that are unavailable, private, or deleted
 * BEFORE they reach the player.
 */

const cache = new Map<string, { available: boolean; checkedAt: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

async function isVideoAvailable(youtubeId: string): Promise<boolean> {
  const cached = cache.get(youtubeId);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
    return cached.available;
  }

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`,
      { next: { revalidate: 1800 } } // Cache at Next.js level too
    );
    const available = res.ok;
    cache.set(youtubeId, { available, checkedAt: Date.now() });
    return available;
  } catch {
    // Network error — assume available to avoid dropping videos unnecessarily
    return true;
  }
}

interface VideoWithYoutubeId {
  youtube_id: string;
  [key: string]: unknown;
}

export async function filterAvailableVideos(videos: VideoWithYoutubeId[]): Promise<VideoWithYoutubeId[]> {
  const results = await Promise.all(
    videos.map(async (video) => ({
      video,
      available: await isVideoAvailable(video.youtube_id),
    }))
  );

  return results.filter((r) => r.available).map((r) => r.video);
}
