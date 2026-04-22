/**
 * reorder_videos — set a channel's playlist order using YouTube IDs.
 * Videos missing from the caller's list are appended at the end in their
 * current order.
 */
import { defineTool } from "../lib/tool";
import { requireOwnership, textContent } from "../lib/shared";
import { invalidateChannelData } from "@/lib/channel-cache";

interface Args {
  channel_id: string;
  ordered_youtube_ids: string[];
}

export const reorderVideos = defineTool<Args>({
  definition: {
    name: "reorder_videos",
    description:
      "Set the playlist order of a channel using YouTube video IDs. Pass the channel id and an ordered array of YouTube IDs. Any videos not in the list are left at the end in their current order.",
    inputSchema: {
      type: "object",
      required: ["channel_id", "ordered_youtube_ids"],
      properties: {
        channel_id: { type: "string", description: "Channel UUID" },
        ordered_youtube_ids: {
          type: "array",
          items: { type: "string" },
          description: "YouTube video IDs in desired order",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const { data: existing, error } = await service
      .from("videos")
      .select("id, youtube_id")
      .eq("channel_id", args.channel_id)
      .order("position");
    if (error) throw new Error(error.message);

    const ytToId = new Map((existing ?? []).map((v) => [v.youtube_id, v.id]));
    const seen = new Set<string>();
    const finalOrder: string[] = [];

    for (const ytId of args.ordered_youtube_ids) {
      const dbId = ytToId.get(ytId);
      if (!dbId) {
        throw new Error(`YouTube ID ${ytId} does not belong to this channel`);
      }
      if (!seen.has(dbId)) {
        seen.add(dbId);
        finalOrder.push(dbId);
      }
    }
    // Append any videos not mentioned in the list.
    for (const v of existing ?? []) {
      if (!seen.has(v.id)) finalOrder.push(v.id);
    }

    const updates = finalOrder.map((id, idx) =>
      service
        .from("videos")
        .update({ position: idx + 1 })
        .eq("id", id)
        .eq("channel_id", args.channel_id)
    );
    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw new Error(firstErr.message);

    invalidateChannelData();

    return textContent(
      `Reordered ${finalOrder.length} video${finalOrder.length === 1 ? "" : "s"}.`
    );
  },
});
