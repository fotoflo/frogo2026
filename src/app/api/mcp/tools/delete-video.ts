/**
 * delete_video — remove a video from its channel's playlist after verifying
 * the caller owns the parent channel.
 */
import { defineTool } from "../lib/tool";
import { requireOwnership, textContent } from "../lib/shared";

interface Args {
  video_id: string;
}

export const deleteVideo = defineTool<Args>({
  definition: {
    name: "delete_video",
    description: "Remove a video from its channel's playlist.",
    inputSchema: {
      type: "object",
      required: ["video_id"],
      properties: {
        video_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    const { data: video, error } = await service
      .from("videos")
      .select("id, channel_id, title")
      .eq("id", args.video_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!video) throw new Error("Video not found");
    await requireOwnership(service, auth.userId, video.channel_id);

    const { error: delErr } = await service
      .from("videos")
      .delete()
      .eq("id", args.video_id);
    if (delErr) throw new Error(delErr.message);

    return textContent(`Deleted "${video.title}".`);
  },
});
