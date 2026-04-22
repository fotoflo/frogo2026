import { MetadataRoute } from "next";
import { channelHref, watchHref } from "@/lib/channel-paths";
import { getChannelTree } from "@/lib/channel-tree";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const channels = await getChannelTree();

  if (!channels.length) {
    return [
      { url: "https://frogo.tv/", priority: 1.0, changeFrequency: "daily" },
      { url: "https://frogo.tv/pair", priority: 0.3 },
      { url: "https://frogo.tv/about", priority: 0.3 },
    ];
  }

  return [
    {
      url: "https://frogo.tv/",
      priority: 1.0,
      changeFrequency: "daily",
    },
    ...channels.map((channel) => ({
      url: `https://frogo.tv${watchHref(channel, channels)}`,
      priority: 0.8,
      changeFrequency: "daily" as const,
    })),
    ...channels.map((channel) => ({
      url: `https://frogo.tv${channelHref(channel, channels)}`,
      priority: 0.5,
      changeFrequency: "weekly" as const,
    })),
    {
      url: "https://frogo.tv/pair",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    {
      url: "https://frogo.tv/about",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
  ];
}
