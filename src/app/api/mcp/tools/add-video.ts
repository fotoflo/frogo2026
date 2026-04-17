/**
 * add_video — append a YouTube video to a channel's playlist. Metadata is
 * fetched via the YouTube Data API (reliable from Vercel; no consent wall).
 */
import { defineTool } from "../lib/tool";
import { requireOwnership, textContent } from "../lib/shared";
import { extractYouTubeId, fetchVideoMetadata } from "@/lib/youtube-api";

interface Args {
  channel_id: string;
  url: string;
}

export const addVideo = defineTool<Args>({
  definition: {
    name: "add_video",
    description:
      "Append a YouTube video to a channel's playlist. Accepts any YouTube URL or bare video id. Title, duration, and thumbnail are fetched from the YouTube Data API.",
    inputSchema: {
      type: "object",
      required: ["channel_id", "url"],
      properties: {
        channel_id: { type: "string", description: "Target channel uuid" },
        url: { type: "string", description: "YouTube URL or video id" },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const youtubeId = extractYouTubeId(args.url);
    if (!youtubeId) {
      throw new Error(`Could not extract a YouTube id from: ${args.url}`);
    }

    const meta = await fetchVideoMetadata(youtubeId);
    if (!meta) {
      throw new Error(
        `YouTube returned no data for ${youtubeId} (deleted, private, or region-blocked).`
      );
    }
    if (meta.isLive || meta.durationSeconds <= 0) {
      throw new Error(
        `Video ${youtubeId} is a live/upcoming stream with no duration — broadcast schedule requires a real length.`
      );
    }

    const { data: last } = await service
      .from("videos")
      .select("position")
      .eq("channel_id", args.channel_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (last?.position ?? 0) + 1;

    const { data, error } = await service
      .from("videos")
      .insert({
        channel_id: args.channel_id,
        youtube_id: meta.youtubeId,
        title: meta.title,
        description: "",
        thumbnail_url: meta.thumbnailUrl,
        duration_seconds: meta.durationSeconds,
        position: nextPosition,
        made_for_kids: meta.madeForKids,
        mfk_checked_at: new Date().toISOString(),
      })
      .select("id, title, position")
      .single();
    if (error) throw new Error(error.message);

    return textContent(
      `Added "${data.title}" at position ${data.position} (video id ${data.id}).`
    );
  },
});
