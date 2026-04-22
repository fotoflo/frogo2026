import { unstable_cache, revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase";
import { filterAvailableVideos } from "@/lib/youtube-check";

export interface CachedVideo {
  id: string;
  youtube_id: string;
  title: string;
  description: string;
  duration_seconds: number;
  start_seconds: number | null;
  end_seconds: number | null;
  thumbnail_url: string;
}

export const VIDEOS_TAG = "channel-videos";

// Per-channel videos + oEmbed availability filter, cached until the tag is
// busted. This is where the oEmbed HEAD-storm used to land on every page load
// — now it runs once per channel per mutation window. unstable_cache auto-
// appends the channelId arg to the cache key, so each channel is its own entry.
export const getChannelVideos = unstable_cache(
  async (channelId: string): Promise<CachedVideo[]> => {
    const supabase = createServiceClient();
    const { data: videos } = await supabase
      .from("videos")
      .select(
        "id, youtube_id, title, description, duration_seconds, start_seconds, end_seconds, thumbnail_url"
      )
      .eq("channel_id", channelId)
      .order("position");

    const available = await filterAvailableVideos(videos ?? []);
    return available as unknown as CachedVideo[];
  },
  ["channel-videos"],
  { tags: [VIDEOS_TAG] }
);

export function invalidateAllVideos() {
  revalidateTag(VIDEOS_TAG, "default");
}
