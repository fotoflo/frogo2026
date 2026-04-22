/**
 * refresh_video_metadata — re-fetch title + duration + thumbnail from YouTube
 * for one video (by youtube_id + channel_id) or every video in a channel.
 * Videos that don't come back from YouTube land in `failed` — NOT auto-deleted.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";
import { fetchVideoMetadataBatch } from "@/lib/youtube-api";
import { invalidateChannelData } from "@/lib/channel-cache";

interface Args {
  youtube_id?: string;
  channel_id: string;
}

interface VideoRow {
  id: string;
  channel_id: string;
  youtube_id: string;
  title: string;
  duration_seconds: number;
  made_for_kids: boolean | null;
}

interface RefreshedEntry {
  youtube_id: string;
  old_title: string;
  new_title: string;
  old_duration_seconds: number;
  new_duration_seconds: number;
}

interface UnchangedEntry {
  youtube_id: string;
  title: string;
}

interface FailedEntry {
  youtube_id: string;
  old_title: string;
  reason: string;
}

export const refreshVideoMetadata = defineTool<Args>({
  definition: {
    name: "refresh_video_metadata",
    description:
      "Re-fetch title + duration + thumbnail from YouTube for one video (`youtube_id` + `channel_id`) or every video in a channel (`channel_id` only). Videos that fail are reported in `failed` but NOT deleted.",
    inputSchema: {
      type: "object",
      required: ["channel_id"],
      properties: {
        youtube_id: {
          type: "string",
          description: "YouTube video ID. Omit to refresh all videos in the channel.",
        },
        channel_id: { type: "string", description: "Channel UUID" },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    let targets: VideoRow[];
    if (args.youtube_id) {
      const { data: v, error } = await service
        .from("videos")
        .select("id, channel_id, youtube_id, title, duration_seconds, made_for_kids")
        .eq("channel_id", args.channel_id)
        .eq("youtube_id", args.youtube_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!v) throw new Error(`Video youtube_id=${args.youtube_id} not found in this channel`);
      targets = [v as VideoRow];
    } else {
      const { data, error } = await service
        .from("videos")
        .select("id, channel_id, youtube_id, title, duration_seconds, made_for_kids")
        .eq("channel_id", args.channel_id)
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
          youtube_id: t.youtube_id,
          old_title: t.title,
          reason: "YouTube returned no data (deleted, private, or region-blocked)",
        });
        continue;
      }
      if (meta.isLive || meta.durationSeconds <= 0) {
        failed.push({
          youtube_id: t.youtube_id,
          old_title: t.title,
          reason: "Live/upcoming stream — no real duration",
        });
        continue;
      }

      if (
        meta.title === t.title &&
        meta.durationSeconds === t.duration_seconds &&
        meta.madeForKids === t.made_for_kids
      ) {
        unchanged.push({ youtube_id: t.youtube_id, title: t.title });
        await service
          .from("videos")
          .update({ mfk_checked_at: new Date().toISOString() })
          .eq("id", t.id);
        continue;
      }

      const { error: upErr } = await service
        .from("videos")
        .update({
          title: meta.title,
          duration_seconds: meta.durationSeconds,
          thumbnail_url: meta.thumbnailUrl,
          made_for_kids: meta.madeForKids,
          mfk_checked_at: new Date().toISOString(),
        })
        .eq("id", t.id);
      if (upErr) {
        failed.push({
          youtube_id: t.youtube_id,
          old_title: t.title,
          reason: upErr.message,
        });
        continue;
      }

      refreshed.push({
        youtube_id: t.youtube_id,
        old_title: t.title,
        new_title: meta.title,
        old_duration_seconds: t.duration_seconds,
        new_duration_seconds: meta.durationSeconds,
      });
    }

    invalidateChannelData();

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
