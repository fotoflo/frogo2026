/**
 * delete_videos_bulk — mirror of add_videos_bulk. Remove many videos from a
 * channel in one call, or wipe the channel's entire playlist. The scoped
 * `channel_id` + ownership check keeps a spoofed `video_ids` list from
 * touching rows in other channels.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";

interface Args {
  channel_id: string;
  video_ids?: string[];
  all?: boolean;
}

export const deleteVideosBulk = defineTool<Args>({
  definition: {
    name: "delete_videos_bulk",
    description:
      "Remove many videos from a channel in one call, or wipe the entire playlist. Provide `channel_id` plus EITHER `video_ids` (array of video uuids to delete) OR `all: true` (delete every video in the channel). Requires channel ownership; deletion is scoped to this channel_id so a spoofed id list can't touch other channels. Returns the number deleted.",
    inputSchema: {
      type: "object",
      required: ["channel_id"],
      properties: {
        channel_id: { type: "string", description: "Target channel uuid" },
        video_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 500,
          description: "Video uuids to delete. Mutually exclusive with `all`.",
        },
        all: {
          type: "boolean",
          description:
            "If true, delete every video in the channel. Mutually exclusive with `video_ids`. Use when a bad import needs to be wiped.",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const hasIds = Array.isArray(args.video_ids) && args.video_ids.length > 0;
    const hasAll = args.all === true;
    if (hasIds === hasAll) {
      throw new Error(
        "Provide exactly one of `video_ids` (non-empty array) or `all: true`."
      );
    }

    let query = service
      .from("videos")
      .delete()
      .eq("channel_id", args.channel_id);
    if (hasIds) query = query.in("id", args.video_ids!);

    const { data, error } = await query.select("id");
    if (error) throw new Error(error.message);

    return jsonContent({
      channel_id: args.channel_id,
      mode: hasAll ? "all" : "by_ids",
      deleted: data?.length ?? 0,
    });
  },
});
