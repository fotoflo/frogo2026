/**
 * reorder_videos — set a channel's playlist order. Videos missing from the
 * caller's list are appended at the end in their current order.
 */
import { defineTool } from "../lib/tool";
import { requireOwnership, textContent } from "../lib/shared";

interface Args {
  channel_id: string;
  ordered_video_ids: string[];
}

export const reorderVideos = defineTool<Args>({
  definition: {
    name: "reorder_videos",
    description:
      "Set the playlist order of a channel. Pass the channel id and an ordered array of video ids. Any videos not in the list are left at the end in their current order.",
    inputSchema: {
      type: "object",
      required: ["channel_id", "ordered_video_ids"],
      properties: {
        channel_id: { type: "string" },
        ordered_video_ids: {
          type: "array",
          items: { type: "string" },
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const { data: existing, error } = await service
      .from("videos")
      .select("id")
      .eq("channel_id", args.channel_id);
    if (error) throw new Error(error.message);

    const existingIds = new Set((existing ?? []).map((v) => v.id));
    const seen = new Set<string>();
    const finalOrder: string[] = [];

    for (const id of args.ordered_video_ids) {
      if (!existingIds.has(id)) {
        throw new Error(`Video ${id} does not belong to this channel`);
      }
      if (!seen.has(id)) {
        seen.add(id);
        finalOrder.push(id);
      }
    }
    // Append any videos not mentioned in the list, in their current order.
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

    return textContent(
      `Reordered ${finalOrder.length} video${finalOrder.length === 1 ? "" : "s"}.`
    );
  },
});
