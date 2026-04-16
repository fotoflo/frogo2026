/**
 * list_channels — return all channels owned by the authenticated user, with
 * full URL path and per-channel video counts.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, ownedChannels } from "../lib/shared";
import { buildChannelPath, type ChannelLike } from "@/lib/channel-paths";

export const listChannels = defineTool<Record<string, never>>({
  definition: {
    name: "list_channels",
    description:
      "List all channels owned by the authenticated user, with full URL path and video counts.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  async handler(service, auth) {
    const channels = await ownedChannels(service, auth.userId);
    const all = channels as unknown as ChannelLike[];

    // Pull video counts in one query.
    const { data: counts, error: countErr } = await service
      .from("videos")
      .select("channel_id")
      .in(
        "channel_id",
        channels.map((c) => c.id)
      );
    if (countErr) throw new Error(countErr.message);

    const countByChannel = new Map<string, number>();
    for (const row of counts ?? []) {
      countByChannel.set(
        row.channel_id,
        (countByChannel.get(row.channel_id) ?? 0) + 1
      );
    }

    const result = channels.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      path: buildChannelPath(c as ChannelLike, all).join("/"),
      description: c.description,
      icon: c.icon,
      parent_id: c.parent_id,
      position: c.position,
      video_count: countByChannel.get(c.id) ?? 0,
    }));

    return jsonContent(result);
  },
});
