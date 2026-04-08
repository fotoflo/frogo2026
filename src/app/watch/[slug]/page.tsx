import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import TVClient from "./TVClient";

async function getChannelData(slug: string) {
  const supabase = createServiceClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!channel) return null;

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channel.id)
    .order("position");

  // Get all channels for the channel guide
  const { data: allChannels } = await supabase
    .from("channels")
    .select("id, slug, name, icon")
    .order("name");

  return { channel, videos: videos ?? [], allChannels: allChannels ?? [] };
}

export default async function WatchChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getChannelData(slug);
  if (!data) notFound();

  return (
    <TVClient
      channel={data.channel}
      videos={data.videos}
      allChannels={data.allChannels}
    />
  );
}
