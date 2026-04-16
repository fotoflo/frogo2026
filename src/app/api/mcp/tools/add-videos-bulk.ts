/**
 * add_videos_bulk — append many YouTube videos to a channel in one call.
 * Each URL is processed independently so a single bad input can't tank the
 * batch: results are bucketed into `added`, `skipped_duplicates`, and
 * `failed`. Processed sequentially because position assignment depends on
 * prior inserts.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";
import { fetchVideoMeta } from "@/lib/youtube-meta";

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
      "Append many YouTube videos to a channel's playlist in one call. Accepts an array of YouTube URLs or bare video IDs. Each is processed independently — one bad URL won't block the others. Returns per-item status: which were added, which were skipped as duplicates (already in this channel), and which failed and why. Use this instead of calling `add_video` in a loop when seeding 5+ videos. If you already know titles/durations for some items, use `add_video` individually with overrides.",
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
          description:
            "Array of YouTube URLs or video IDs. Capped at 100 per call.",
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

    const added: AddedItem[] = [];
    const skipped_duplicates: SkippedItem[] = [];
    const failed: FailedItem[] = [];

    for (const url of args.urls) {
      try {
        const meta = await fetchVideoMeta(url);
        if (!meta) {
          failed.push({
            url,
            reason:
              "Could not fetch YouTube metadata (likely consent wall or invalid id). Use `add_video` with title+duration overrides.",
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
            thumbnail_url: `https://img.youtube.com/vi/${meta.youtubeId}/mqdefault.jpg`,
            duration_seconds: meta.durationSeconds,
            position: nextPosition,
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
      } catch (err) {
        failed.push({
          url,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
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
