/**
 * refresh_video_metadata — re-fetch title + duration + thumbnail from YouTube
 * for one video or every video in a channel. For channel-wide refreshes,
 * metadata is batched 50-at-a-time via the Data API. Videos that don't come
 * back from YouTube (deleted/private/region-blocked) land in `failed` — NOT
 * auto-deleted, so the caller can review and choose to call delete_video.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";
import { fetchVideoMetadataBatch } from "@/lib/youtube-api";

interface Args {
  video_id?: string;
  channel_id?: string;
}

interface VideoRow {
  id: string;
  channel_id: string;
  youtube_id: string;
  title: string;
  duration_seconds: number;
}

interface RefreshedEntry {
  video_id: string;
  youtube_id: string;
  old_title: string;
  new_title: string;
  old_duration_seconds: number;
  new_duration_seconds: number;
}

interface UnchangedEntry {
  video_id: string;
  youtube_id: string;
  title: string;
}

interface FailedEntry {
  video_id: string;
  youtube_id: string;
  old_title: string;
  reason: string;
}

export const refreshVideoMetadata = defineTool<Args>({
  definition: {
    name: "refresh_video_metadata",
    description:
      "Re-fetch title + duration + thumbnail from YouTube for one video (`video_id`) or every video in a channel (`channel_id`). Catches title changes, deleted videos, and region blocks. Videos that fail to refresh are reported in `failed` but NOT deleted automatically — review them and call `delete_video` if needed. Provide exactly one of `video_id` or `channel_id`.",
    inputSchema: {
      type: "object",
      properties: {
        video_id: { type: "string" },
        channel_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    if (!args.video_id && !args.channel_id) {
      throw new Error("Provide either `video_id` or `channel_id`");
    }
    if (args.video_id && args.channel_id) {
      throw new Error("Provide either `video_id` or `channel_id`, not both");
    }

    let targets: VideoRow[];
    if (args.video_id) {
      const { data: v, error } = await service
        .from("videos")
        .select("id, channel_id, youtube_id, title, duration_seconds")
        .eq("id", args.video_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!v) throw new Error("Video not found");
      await requireOwnership(service, auth.userId, v.channel_id);
      targets = [v as VideoRow];
    } else {
      await requireOwnership(service, auth.userId, args.channel_id!);
      const { data, error } = await service
        .from("videos")
        .select("id, channel_id, youtube_id, title, duration_seconds")
        .eq("channel_id", args.channel_id!)
        .order("position");
      if (error) throw new Error(error.message);
      targets = (data ?? []) as VideoRow[];
    }

    const metaMap = await fetchVideoMetadataBatch(
      targets.map((t) => t.youtube_id)
    );

    const refreshed: RefreshedEntry[] = [];
    const unchanged: UnchangedEntry[] = [];
    const failed: FailedEntry[] = [];

    for (const t of targets) {
      const meta = metaMap.get(t.youtube_id);
      if (!meta) {
        failed.push({
          video_id: t.id,
          youtube_id: t.youtube_id,
          old_title: t.title,
          reason: "YouTube returned no data (deleted, private, or region-blocked)",
        });
        continue;
      }
      if (meta.isLive || meta.durationSeconds <= 0) {
        failed.push({
          video_id: t.id,
          youtube_id: t.youtube_id,
          old_title: t.title,
          reason: "Live/upcoming stream — no real duration",
        });
        continue;
      }

      if (
        meta.title === t.title &&
        meta.durationSeconds === t.duration_seconds
      ) {
        unchanged.push({
          video_id: t.id,
          youtube_id: t.youtube_id,
          title: t.title,
        });
        continue;
      }

      const { error: upErr } = await service
        .from("videos")
        .update({
          title: meta.title,
          duration_seconds: meta.durationSeconds,
          thumbnail_url: meta.thumbnailUrl,
        })
        .eq("id", t.id);
      if (upErr) {
        failed.push({
          video_id: t.id,
          youtube_id: t.youtube_id,
          old_title: t.title,
          reason: upErr.message,
        });
        continue;
      }

      refreshed.push({
        video_id: t.id,
        youtube_id: t.youtube_id,
        old_title: t.title,
        new_title: meta.title,
        old_duration_seconds: t.duration_seconds,
        new_duration_seconds: meta.durationSeconds,
      });
    }

    return jsonContent({
      refreshed,
      unchanged,
      failed,
      summary: {
        refreshed: refreshed.length,
        unchanged: unchanged.length,
        failed: failed.length,
      },
    });
  },
});
