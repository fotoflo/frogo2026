/**
 * add_videos_bulk — append many YouTube videos to a channel in one call.
 * Metadata is fetched in batches of 50 via the YouTube Data API (1 quota
 * unit per chunk). A URL that can't be parsed or has no API result lands in
 * `failed`; a URL already in the channel lands in `skipped_duplicates`;
 * everything else is inserted in order.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";
import { extractYouTubeId, fetchVideoMetadataBatch } from "@/lib/youtube-api";

interface Args {
  channel_id: string;
  urls: string[];
}

interface AddedItem {
  url: string;
  video_id: string;
  title: string;
  position: number;
}

interface SkippedItem {
  url: string;
  youtube_id: string;
}

interface FailedItem {
  url: string;
  reason: string;
}

export const addVideosBulk = defineTool<Args>({
  definition: {
    name: "add_videos_bulk",
    description:
      "Append many YouTube videos to a channel's playlist in one call. Accepts an array of YouTube URLs or bare video IDs. Metadata is fetched from the YouTube Data API in batches of 50. Returns per-item status: `added`, `skipped_duplicates`, and `failed`. Use this instead of calling `add_video` in a loop when seeding 5+ videos.",
    inputSchema: {
      type: "object",
      required: ["channel_id", "urls"],
      properties: {
        channel_id: { type: "string", description: "Target channel uuid" },
        urls: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 100,
          description: "Array of YouTube URLs or video IDs. Capped at 100 per call.",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    if (!Array.isArray(args.urls) || args.urls.length === 0) {
      throw new Error("`urls` must be a non-empty array");
    }

    const added: AddedItem[] = [];
    const skipped_duplicates: SkippedItem[] = [];
    const failed: FailedItem[] = [];

    // Parse URLs → IDs, remember the original URL for reporting.
    const parsed: { url: string; youtubeId: string }[] = [];
    for (const url of args.urls) {
      const id = extractYouTubeId(url);
      if (!id) {
        failed.push({ url, reason: "Could not extract a YouTube id from input" });
        continue;
      }
      parsed.push({ url, youtubeId: id });
    }

    const metaMap = parsed.length
      ? await fetchVideoMetadataBatch(parsed.map((p) => p.youtubeId))
      : new Map();

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

    for (const { url, youtubeId } of parsed) {
      const meta = metaMap.get(youtubeId);
      if (!meta) {
        failed.push({
          url,
          reason: "YouTube returned no data (deleted, private, or region-blocked)",
        });
        continue;
      }
      if (meta.isLive || meta.durationSeconds <= 0) {
        failed.push({
          url,
          reason: "Live stream or unknown duration — broadcast schedule requires a real length",
        });
        continue;
      }
      if (existingIds.has(meta.youtubeId)) {
        skipped_duplicates.push({ url, youtube_id: meta.youtubeId });
        continue;
      }

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

      if (error) {
        failed.push({ url, reason: error.message });
        continue;
      }

      existingIds.add(meta.youtubeId);
      added.push({
        url,
        video_id: data.id,
        title: data.title,
        position: nextPosition,
      });
      nextPosition += 1;
    }

    return jsonContent({
      added,
      skipped_duplicates,
      failed,
      summary: {
        added: added.length,
        skipped: skipped_duplicates.length,
        failed: failed.length,
      },
    });
  },
});
