/**
 * import_youtube_channel — bulk-import recent videos from a YouTube channel.
 * Source accepts an `@handle`, bare `UC...` id, or full URL. Uses the Data
 * API: resolves handle → channel id → uploads playlist (deterministic: UC
 * swapped to UU) → `playlistItems.list` for IDs → batched `videos.list` for
 * durations. Live streams and items with no duration are skipped.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";
import { fetchChannelVideos } from "@/lib/youtube-api";

interface Args {
  channel_id: string;
  source: string;
  max_videos?: number;
}

export const importYoutubeChannel = defineTool<Args>({
  definition: {
    name: "import_youtube_channel",
    description:
      "Import recent videos from a YouTube channel into one of your channels. `source` accepts an `@handle` (e.g. `@bluey`), a bare channel id (`UC...`), or a full channel URL. Defaults to importing 30 videos; pass `max_videos` to change (cap 200). Live streams and videos with no published duration are skipped (broadcast schedule needs a real length).",
    inputSchema: {
      type: "object",
      required: ["channel_id", "source"],
      properties: {
        channel_id: { type: "string", description: "Target Frogo channel uuid" },
        source: {
          type: "string",
          description: "YouTube channel handle (`@bluey`), id (`UC...`), or full URL",
        },
        max_videos: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Max videos to import (default 30)",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const max = Math.min(Math.max(1, args.max_videos ?? 30), 200);

    const videos = await fetchChannelVideos(args.source, max);
    if (videos.length === 0) {
      throw new Error(
        "Channel returned no videos (it may be empty, members-only, or the handle didn't resolve)."
      );
    }

    const { data: existing } = await service
      .from("videos")
      .select("youtube_id, position")
      .eq("channel_id", args.channel_id);
    const existingIds = new Set(
      (existing ?? []).map((v: { youtube_id: string }) => v.youtube_id)
    );
    let nextPosition =
      Math.max(
        0,
        ...(existing ?? []).map(
          (v: { position: number | null }) => v.position ?? 0
        )
      ) + 1;

    const imported: Array<{
      video_id: string;
      youtube_id: string;
      title: string;
      position: number;
      duration_seconds: number;
    }> = [];
    const skipped_duplicates: Array<{ youtube_id: string; title: string }> = [];
    const failed: Array<{ youtube_id: string; title: string; reason: string }> = [];

    for (const v of videos) {
      if (existingIds.has(v.youtubeId)) {
        skipped_duplicates.push({ youtube_id: v.youtubeId, title: v.title });
        continue;
      }
      if (v.isLive || v.durationSeconds <= 0) {
        failed.push({
          youtube_id: v.youtubeId,
          title: v.title,
          reason: "Live stream or unknown duration — skipped",
        });
        continue;
      }

      const { data, error } = await service
        .from("videos")
        .insert({
          channel_id: args.channel_id,
          youtube_id: v.youtubeId,
          title: v.title,
          description: "",
          thumbnail_url: v.thumbnailUrl,
          duration_seconds: v.durationSeconds,
          position: nextPosition,
          made_for_kids: v.madeForKids,
          mfk_checked_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        failed.push({ youtube_id: v.youtubeId, title: v.title, reason: error.message });
        continue;
      }

      existingIds.add(v.youtubeId);
      imported.push({
        video_id: data.id,
        youtube_id: v.youtubeId,
        title: v.title,
        position: nextPosition,
        duration_seconds: v.durationSeconds,
      });
      nextPosition++;
    }

    return jsonContent({
      source: args.source,
      imported,
      skipped_duplicates,
      failed,
      summary: {
        imported: imported.length,
        skipped: skipped_duplicates.length,
        failed: failed.length,
      },
    });
  },
});
