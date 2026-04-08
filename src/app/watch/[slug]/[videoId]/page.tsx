import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import WatchClient from "./WatchClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; videoId: string }>;
}): Promise<Metadata> {
  const { slug, videoId } = await params;
  const supabase = createServiceClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("name, icon")
    .eq("slug", slug)
    .single();

  const { data: video } = await supabase
    .from("videos")
    .select("title, description, thumbnail_url")
    .eq("id", videoId)
    .single();

  if (!channel || !video) return {};

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
