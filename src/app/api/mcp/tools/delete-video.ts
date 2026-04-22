/**
 * delete_video — remove a video from its channel's playlist after verifying
 * the caller owns the parent channel. Accepts youtube_id + channel_id.
 */
import { defineTool } from "../lib/tool";
import { requireOwnership, textContent } from "../lib/shared";
import { invalidateChannelData } from "@/lib/channel-cache";

interface Args {
  youtube_id: string;
  channel_id: string;
}

export const deleteVideo = defineTool<Args>({
  definition: {
    name: "delete_video",
    description:
      "Remove a video from a channel's playlist by its YouTube ID.",
    inputSchema: {
      type: "object",
      required: ["youtube_id", "channel_id"],
      properties: {
        youtube_id: { type: "string", description: "YouTube video ID" },
        channel_id: { type: "string", description: "Channel UUID" },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const { data: video, error } = await service
      .from("videos")
      .select("id, title")
      .eq("channel_id", args.channel_id)
      .eq("youtube_id", args.youtube_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!video) throw new Error(`Video youtube_id=${args.youtube_id} not found in this channel`);

    const { error: delErr } = await service
      .from("videos")
      .delete()
      .eq("id", video.id);
    if (delErr) throw new Error(delErr.message);

    invalidateChannelData();

    return textContent(`Deleted "${video.title}".`);
  },
});
