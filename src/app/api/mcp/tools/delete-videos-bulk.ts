/**
 * delete_videos_bulk — remove many videos from a channel by YouTube ID,
 * or wipe the channel's entire playlist.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";
import { invalidateChannelData } from "@/lib/channel-cache";

interface Args {
  channel_id: string;
  youtube_ids?: string[];
  all?: boolean;
}

export const deleteVideosBulk = defineTool<Args>({
  definition: {
    name: "delete_videos_bulk",
    description:
      "Remove many videos from a channel in one call, or wipe the entire playlist. Provide `channel_id` plus EITHER `youtube_ids` (array of YouTube video IDs to delete) OR `all: true` (delete every video in the channel). Returns the number deleted.",
    inputSchema: {
      type: "object",
      required: ["channel_id"],
      properties: {
        channel_id: { type: "string", description: "Target channel UUID" },
        youtube_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 500,
          description: "YouTube video IDs to delete. Mutually exclusive with `all`.",
        },
        all: {
          type: "boolean",
          description:
            "If true, delete every video in the channel. Mutually exclusive with `youtube_ids`.",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const hasIds = Array.isArray(args.youtube_ids) && args.youtube_ids.length > 0;
    const hasAll = args.all === true;
    if (hasIds === hasAll) {
      throw new Error(
        "Provide exactly one of `youtube_ids` (non-empty array) or `all: true`."
      );
    }

    let query = service
      .from("videos")
      .delete()
      .eq("channel_id", args.channel_id);
    if (hasIds) query = query.in("youtube_id", args.youtube_ids!);

    const { data, error } = await query.select("id");
    if (error) throw new Error(error.message);

    invalidateChannelData();

    return jsonContent({
      channel_id: args.channel_id,
      mode: hasAll ? "all" : "by_youtube_ids",
      deleted: data?.length ?? 0,
    });
  },
});
