/**
 * get_channel — fetch one owned channel (by id or URL path) plus its
 * ordered playlist.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, ownedChannels } from "../lib/shared";
import {
  buildChannelPath,
  findChannelByPath,
  type ChannelLike,
} from "@/lib/channel-paths";

interface Args {
  id?: string;
  path?: string;
}

export const getChannel = defineTool<Args>({
  definition: {
    name: "get_channel",
    description:
      "Get one owned channel by id, slug, or URL path (e.g. 'business/startups'), including its ordered playlist.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Channel uuid" },
        path: {
          type: "string",
          description: "URL path like 'business/startups' or just 'jazz'",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    if (!args.id && !args.path) {
      throw new Error("Must provide either `id` or `path`");
    }
    const channels = await ownedChannels(service, auth.userId);
    const all = channels as unknown as ChannelLike[];

    let channel: (typeof channels)[number] | undefined;
    if (args.id) {
      channel = channels.find((c) => c.id === args.id);
    } else if (args.path) {
      const segments = args.path.split("/").filter(Boolean);
      const resolved = findChannelByPath(segments, all);
      if (resolved) channel = channels.find((c) => c.id === resolved.id);
    }
    if (!channel) throw new Error("Channel not found or not owned by you");

    const { data: videos, error: vErr } = await service
      .from("videos")
      .select(
        "id, youtube_id, title, thumbnail_url, duration_seconds, start_seconds, end_seconds, position"
      )
      .eq("channel_id", channel.id)
      .order("position");
    if (vErr) throw new Error(vErr.message);

    return jsonContent({
      id: channel.id,
      name: channel.name,
      slug: channel.slug,
      path: buildChannelPath(channel as ChannelLike, all).join("/"),
      description: channel.description,
      icon: channel.icon,
      parent_id: channel.parent_id,
      videos: videos ?? [],
    });
  },
});
