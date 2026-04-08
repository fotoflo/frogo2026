import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { filterAvailableVideos } from "@/lib/youtube-check";
import TVClient from "./TVClient";

interface ChannelWithVideos {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  videos: {
    id: string;
    youtube_id: string;
    title: string;
    description: string;
    duration_seconds: number;
    thumbnail_url: string;
  }[];
}

async function getAllChannelData(initialSlug: string) {
  const supabase = createServiceClient();

  const { data: allChannels } = await supabase
    .from("channels")
    .select("*")
    .order("name");

  if (!allChannels?.length) return null;

  // Verify the initial slug exists
  const initialChannel = allChannels.find((c) => c.slug === initialSlug);
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
        name: channel.name,
        icon: channel.icon,
        description: channel.description,
        videos: available as ChannelWithVideos["videos"],
      };
    })
  );

  const initialIndex = channelsWithVideos.findIndex(
    (c) => c.slug === initialSlug
  );

  return { channels: channelsWithVideos, initialIndex };
}

export default async function WatchChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getAllChannelData(slug);
  if (!data) notFound();

  return (
    <TVClient
      channels={data.channels}
      initialChannelIndex={data.initialIndex}
    />
  );
}
