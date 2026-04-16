/**
 * search_channels — find owned channels by case-insensitive substring match
 * on name/slug/description. Returns matches with full URL path and video
 * counts. Useful when the caller doesn't remember a channel's id.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, ownedChannels } from "../lib/shared";
import { buildChannelPath, type ChannelLike } from "@/lib/channel-paths";

interface Args {
  query: string;
  limit?: number;
}

export const searchChannels = defineTool<Args>({
  definition: {
    name: "search_channels",
    description:
      "Search your owned channels by substring match on name, slug, or description (case-insensitive). Returns matching channels with their full URL path. Use this to find a channel id when you don't remember it. Default limit 20, cap 100.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          minLength: 1,
          description:
            "Substring to match against name/slug/description (case-insensitive)",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Max results (default 20)",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    const q = (args.query ?? "").trim();
    if (!q) throw new Error("`query` cannot be empty");

    const limit = Math.min(Math.max(1, args.limit ?? 20), 100);

    const channels = await ownedChannels(service, auth.userId);

    const ql = q.toLowerCase();
    const matches = channels
      .filter(
        (c) =>
          c.name.toLowerCase().includes(ql) ||
          c.slug.toLowerCase().includes(ql) ||
          (c.description ?? "").toLowerCase().includes(ql)
      )
      .slice(0, limit);

    const ids = matches.map((c) => c.id);
    const countByChannel = new Map<string, number>();
    if (ids.length > 0) {
      const { data: counts, error: countErr } = await service
        .from("videos")
        .select("channel_id")
        .in("channel_id", ids);
      if (countErr) throw new Error(countErr.message);
      for (const row of counts ?? []) {
        countByChannel.set(
          row.channel_id,
          (countByChannel.get(row.channel_id) ?? 0) + 1
        );
      }
    }

    const all = channels as unknown as ChannelLike[];
    const result = matches.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      path: buildChannelPath(c as ChannelLike, all).join("/"),
      description: c.description,
      icon: c.icon,
      parent_id: c.parent_id,
      video_count: countByChannel.get(c.id) ?? 0,
    }));

    return jsonContent(result);
  },
});
