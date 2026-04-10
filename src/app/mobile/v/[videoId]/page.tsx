import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { mobileChannelHref } from "@/lib/channel-paths";
import MobileWatchClient from "./MobileWatchClient";

export default async function MobileWatchPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const supabase = createServiceClient();

  const { data: video } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .single();
  if (!video) notFound();

  const { data: allChannels } = await supabase.from("channels").select("*");
  const channel = allChannels?.find((c) => c.id === video.channel_id);
  if (!channel || !allChannels) notFound();

  const { data: playlist } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channel.id)
    .order("position");

  return (
    <MobileWatchClient
      channel={channel}
      video={video}
      playlist={playlist ?? []}
      channelPath={mobileChannelHref(channel, allChannels)}
    />
  );
}
