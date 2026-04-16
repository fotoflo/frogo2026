/**
 * search_videos — case-insensitive substring search across the user's videos.
 * Optionally scoped to a single owned channel. Each hit is enriched with the
 * channel id, name, and full URL path so callers know where the match lives.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, ownedChannels } from "../lib/shared";
import { buildChannelPath, type ChannelLike } from "@/lib/channel-paths";

interface Args {
  query: string;
  channel_id?: string;
  limit?: number;
}

export const searchVideos = defineTool<Args>({
  definition: {
    name: "search_videos",
    description:
      "Search videos in your owned channels by case-insensitive substring match on title. Pass `channel_id` to scope to one channel; otherwise searches across all your channels. Each result includes channel context (id, name, path) so you know where the hit lives. Default limit 50, cap 200.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          minLength: 1,
          description:
            "Substring to match against video titles (case-insensitive)",
        },
        channel_id: {
          type: "string",
          description: "Optional — scope search to this channel",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Max results (default 50)",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    const q = (args.query ?? "").trim();
    if (!q) throw new Error("`query` cannot be empty");

    const limit = Math.min(Math.max(1, args.limit ?? 50), 200);

    const channels = await ownedChannels(service, auth.userId);

    let scopeIds: string[];
    if (args.channel_id) {
      const owned = channels.find((c) => c.id === args.channel_id);
      if (!owned) throw new Error("Channel not found or not owned by you");
      scopeIds = [args.channel_id];
    } else {
      scopeIds = channels.map((c) => c.id);
    }
    if (scopeIds.length === 0) {
      return jsonContent([]);
    }

    const escaped = q
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");

    const { data: rows, error } = await service
      .from("videos")
      .select(
        "id, channel_id, youtube_id, title, thumbnail_url, duration_seconds, position"
      )
      .in("channel_id", scopeIds)
      .ilike("title", `%${escaped}%`)
      .order("title")
      .limit(limit);
    if (error) throw new Error(error.message);

    const all = channels as unknown as ChannelLike[];
    const channelById = new Map(channels.map((c) => [c.id, c]));
    const result = (rows ?? []).map((r) => {
      const ch = channelById.get(r.channel_id);
      return {
        id: r.id,
        channel_id: r.channel_id,
        channel_name: ch?.name ?? null,
        channel_path: ch
          ? buildChannelPath(ch as ChannelLike, all).join("/")
          : null,
        youtube_id: r.youtube_id,
        title: r.title,
        thumbnail_url: r.thumbnail_url,
        duration_seconds: r.duration_seconds,
        position: r.position,
      };
    });

    return jsonContent(result);
  },
});
