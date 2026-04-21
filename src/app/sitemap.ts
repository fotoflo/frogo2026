import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase";
import { channelHref, watchHref } from "@/lib/channel-paths";

interface Channel {
  id: string;
  slug: string;
  parent_id: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient();
  const { data: channels, error } = await supabase
    .from("channels")
    .select("id, slug, parent_id")
    .order("position", { ascending: true, nullsFirst: false });

  if (error || !channels) {
    console.warn("Failed to fetch channels for sitemap:", error);
    // Return minimal sitemap if DB fetch fails
    return [
      { url: "https://frogo.tv/", priority: 1.0, changeFrequency: "daily" },
      { url: "https://frogo.tv/pair", priority: 0.3 },
      { url: "https://frogo.tv/about", priority: 0.3 },
    ];
  }

  const typedChannels: Channel[] = channels;
  const sitemap: MetadataRoute.Sitemap = [
    // Home
    {
      url: "https://frogo.tv/",
      priority: 1.0,
      changeFrequency: "daily",
    },
    // Channel watch pages: /[nested/path]
    ...typedChannels.map((channel) => ({
      url: `https://frogo.tv${watchHref(channel, typedChannels)}`,
      priority: 0.8,
      changeFrequency: "daily" as const,
    })),
    // Channel detail pages: /channel/[nested/path]
    ...typedChannels.map((channel) => ({
      url: `https://frogo.tv${channelHref(channel, typedChannels)}`,
      priority: 0.5,
      changeFrequency: "weekly" as const,
    })),
    // /pair
    {
      url: "https://frogo.tv/pair",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    // /about
    {
      url: "https://frogo.tv/about",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
  ];

  return sitemap;
}
