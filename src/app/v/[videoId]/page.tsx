import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { isMobileRequest } from "@/lib/mobile-detect";
import { channelHref, mobileVideoHref } from "@/lib/channel-paths";
import WatchClient from "./WatchClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string }>;
}): Promise<Metadata> {
  const { videoId } = await params;
  const supabase = createServiceClient();

  const { data: video } = await supabase
    .from("videos")
    .select("title, description, thumbnail_url, channel_id")
    .eq("id", videoId)
    .single();

  if (!video) return {};

  const { data: channel } = await supabase
    .from("channels")
    .select("name, icon")
    .eq("id", video.channel_id)
    .single();

  if (!channel) return {};

  const title = `${video.title} — ${channel.icon} ${channel.name} — Frogo.tv`;
  const description = video.description || `Watch on ${channel.name} — Frogo.tv`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Frogo.tv",
      type: "video.other",
      ...(video.thumbnail_url && {
        images: [{ url: video.thumbnail_url, width: 480, height: 360 }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(video.thumbnail_url && { images: [video.thumbnail_url] }),
    },
  };
}

async function getData(videoId: string) {
  const supabase = createServiceClient();

  const { data: video } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .single();
  if (!video) return null;

  const { data: allChannels } = await supabase.from("channels").select("*");
  if (!allChannels) return null;
  const channel = allChannels.find((c) => c.id === video.channel_id);
  if (!channel) return null;

  const { data: playlist } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channel.id)
    .order("position");

  return {
    channel,
    video,
    playlist: playlist ?? [],
    channelPath: channelHref(channel, allChannels),
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  if (await isMobileRequest()) {
    redirect(mobileVideoHref(videoId));
  }
  const data = await getData(videoId);
  if (!data) notFound();

  return (
    <WatchClient
      channel={data.channel}
      video={data.video}
      playlist={data.playlist}
      channelPath={data.channelPath}
    />
  );
}
