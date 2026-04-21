import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { isMobileRequest } from "@/lib/mobile-detect";
import {
  findChannelByPath,
  firstLeafDescendant,
  mobileChannelHref,
} from "@/lib/channel-paths";
import { getAllChannelData } from "@/lib/channel-data";
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

  // Folder landing: if the resolved channel has children, redirect to its
  // first leaf descendant so something actually plays. Leaves fall through.
  const initial = data.channels[data.initialIndex];
  const leaf = firstLeafDescendant(initial, data.channels);
  if (leaf.id !== initial.id) {
    redirect(`/${leaf.path.join("/")}`);
  }

  return (
    <TVClient
      channels={data.channels}
      initialChannelIndex={data.initialIndex}
    />
  );
}
