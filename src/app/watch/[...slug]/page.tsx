import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { filterAvailableVideos } from "@/lib/youtube-check";
import { isMobileRequest } from "@/lib/mobile-detect";
import {
  buildChannelPath,
  findChannelByPath,
  mobileChannelHref,
} from "@/lib/channel-paths";
import TVClient from "./TVClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data: allChannels } = await supabase
    .from("channels")
    .select("id, slug, parent_id, name, icon, description");
  const channel = allChannels
    ? findChannelByPath(slug, allChannels)
    : null;

  if (!channel) return {};

  const title = `${channel.icon} ${channel.name} — Frogo.tv`;
  const description =
    channel.description || `Watch ${channel.name} on Frogo.tv`;
  // OG image lives at a real API route — the opengraph-image.tsx metadata
  // file convention can't be nested inside a catch-all segment.
  const ogImage = {
    url: `/api/og/${slug.join("/")}`,
    width: 1200,
    height: 630,
    alt: `${channel.name} — Frogo.tv`,
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Frogo.tv",
      type: "video.other",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  };
}

interface ChannelWithVideos {
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

async function getAllChannelData(pathSegments: string[]) {
  const supabase = createServiceClient();

  const { data: allChannels } = await supabase
    .from("channels")
    .select("*")
    .order("position", { ascending: true, nullsFirst: false })
    .order("name");

  if (!allChannels?.length) return null;

  // Resolve the requested path segments to a concrete channel
  const initialChannel = findChannelByPath(pathSegments, allChannels);
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

export default async function WatchChannelPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (await isMobileRequest()) {
    const supabase = createServiceClient();
    const { data: allChannels } = await supabase
      .from("channels")
      .select("id, slug, parent_id");
    const channel = allChannels
      ? findChannelByPath(slug, allChannels)
      : null;
    if (channel) redirect(mobileChannelHref(channel, allChannels!));
  }
  const data = await getAllChannelData(slug);
  if (!data) notFound();

  return (
    <TVClient
      channels={data.channels}
      initialChannelIndex={data.initialIndex}
    />
  );
}
