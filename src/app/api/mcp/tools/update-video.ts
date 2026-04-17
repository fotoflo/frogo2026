/**
 * update_video — override a video's metadata (title / thumbnail / description)
 * after verifying the caller owns the parent channel. Accepts youtube_id +
 * channel_id instead of internal UUID.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";

interface Args {
  youtube_id: string;
  channel_id: string;
  title?: string;
  thumbnail_url?: string;
  description?: string;
}

export const updateVideo = defineTool<Args>({
  definition: {
    name: "update_video",
    description:
      "Override a video's metadata by YouTube ID. Useful when YouTube's auto-fetched title is generic or you want a custom thumbnail. Any omitted field is left unchanged. Must provide at least one of `title`, `thumbnail_url`, `description`.",
    inputSchema: {
      type: "object",
      required: ["youtube_id", "channel_id"],
      properties: {
        youtube_id: { type: "string", description: "YouTube video ID" },
        channel_id: { type: "string", description: "Channel UUID" },
        title: { type: "string", description: "New title (non-empty)" },
        thumbnail_url: { type: "string", description: "New thumbnail URL" },
        description: {
          type: "string",
          description: "New description (can be empty string to clear)",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const { data: video, error } = await service
      .from("videos")
      .select("id, youtube_id, title, thumbnail_url, description")
      .eq("channel_id", args.channel_id)
      .eq("youtube_id", args.youtube_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!video) throw new Error(`Video youtube_id=${args.youtube_id} not found in this channel`);

    const update: Record<string, unknown> = {};
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("`title` cannot be empty");
      update.title = t;
    }
    if (args.thumbnail_url !== undefined) {
      const u = args.thumbnail_url.trim();
      if (!u)
        throw new Error(
          "`thumbnail_url` cannot be empty — omit the field to leave it unchanged"
        );
      update.thumbnail_url = u;
    }
    if (args.description !== undefined) {
      update.description = args.description;
    }
    if (Object.keys(update).length === 0) {
      throw new Error(
        "No fields to update — provide at least one of title, thumbnail_url, description"
      );
    }

    const { data: updated, error: upErr } = await service
      .from("videos")
      .update(update)
      .eq("id", video.id)
      .select(
        "id, channel_id, youtube_id, title, thumbnail_url, description, duration_seconds, position"
      )
      .single();
    if (upErr) throw new Error(upErr.message);

    return jsonContent(updated);
  },
});
