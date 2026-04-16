/**
 * list_videos — return the ordered playlist for an owned channel. Use
 * before reordering, deleting, or deduping videos.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, ownedChannels } from "../lib/shared";
import { findChannelByPath, type ChannelLike } from "@/lib/channel-paths";

interface Args {
  channel_id?: string;
  path?: string;
}

export const listVideos = defineTool<Args>({
  definition: {
    name: "list_videos",
    description:
      "List the ordered videos in an owned channel. Identify the channel by `channel_id` (uuid) OR `path` (URL path like 'business/startups'). Returns id, youtube_id, title, thumbnail_url, duration_seconds, and position for each video. Use this before `reorder_videos`, `delete_video`, or to dedupe.",
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "Channel uuid" },
        path: {
          type: "string",
          description: "URL path like 'business/startups'",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    if (!args.channel_id && !args.path) {
      throw new Error("Must provide either `id`/`channel_id` or `path`");
    }
    const channels = await ownedChannels(service, auth.userId);
    const all = channels as unknown as ChannelLike[];

    let channel: (typeof channels)[number] | undefined;
    if (args.channel_id) {
      channel = channels.find((c) => c.id === args.channel_id);
    } else if (args.path) {
      const segments = args.path.split("/").filter(Boolean);
      const resolved = findChannelByPath(segments, all);
      if (resolved) channel = channels.find((c) => c.id === resolved.id);
    }
    if (!channel) throw new Error("Channel not found or not owned by you");

    const { data: videos, error } = await service
      .from("videos")
      .select(
        "id, youtube_id, title, thumbnail_url, duration_seconds, position"
      )
      .eq("channel_id", channel.id)
      .order("position");
    if (error) throw new Error(error.message);

    return jsonContent(videos ?? []);
  },
});
