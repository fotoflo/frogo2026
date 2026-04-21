import { createServiceClient } from "@/lib/supabase";
import { filterAvailableVideos } from "@/lib/youtube-check";
import {
  buildChannelPath,
  findChannelByPath,
} from "@/lib/channel-paths";

export interface ChannelWithVideos {
  id: string;
  slug: string;
  parent_id: string | null;
  path: string[];
  name: string;
  icon: string;
  description: string;
  videos: {
    id: string;
    youtube_id: string;
    title: string;
    description: string;
    duration_seconds: number;
    start_seconds: number | null;
    end_seconds: number | null;
    thumbnail_url: string;
  }[];
}

export async function getAllChannelData(pathSegments: string[]) {
  const supabase = createServiceClient();

  const { data: allChannels } = await supabase
    .from("channels")
    .select("*")
    .order("position", { ascending: true, nullsFirst: false })
    .order("name");

  if (!allChannels?.length) return null;

  // Resolve the requested path segments to a concrete channel
  // If pathSegments is empty, use the first root-level channel
  let initialChannel = null;
  if (pathSegments.length === 0) {
    initialChannel = allChannels.find((c) => c.parent_id === null);
  } else {
    initialChannel = findChannelByPath(pathSegments, allChannels);
  }

  if (!initialChannel) return null;

  // Fetch videos for all channels in parallel
  const channelsWithVideos: ChannelWithVideos[] = await Promise.all(
    allChannels.map(async (channel) => {
      const { data: videos } = await supabase
        .from("videos")
        .select("*")
        .eq("channel_id", channel.id)
        .order("position");

      const available = await filterAvailableVideos(videos ?? []);

      return {
        id: channel.id,
        slug: channel.slug,
        parent_id: channel.parent_id,
        path: buildChannelPath(channel, allChannels),
        name: channel.name,
        icon: channel.icon,
        description: channel.description,
        videos: available as ChannelWithVideos["videos"],
      };
    })
  );

  const initialIndex = channelsWithVideos.findIndex(
    (c) => c.id === initialChannel.id
  );

  return { channels: channelsWithVideos, initialIndex };
}
