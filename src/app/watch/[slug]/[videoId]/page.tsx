import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import WatchClient from "./WatchClient";

async function getData(slug: string, videoId: string) {
  const supabase = createServiceClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!channel) return null;

  const { data: video } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("channel_id", channel.id)
    .single();
  if (!video) return null;

  const { data: playlist } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channel.id)
    .order("position");

  return { channel, video, playlist: playlist ?? [] };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string; videoId: string }>;
}) {
  const { slug, videoId } = await params;
  const data = await getData(slug, videoId);
  if (!data) notFound();

  return (
    <WatchClient
      channel={data.channel}
      video={data.video}
      playlist={data.playlist}
    />
  );
}
