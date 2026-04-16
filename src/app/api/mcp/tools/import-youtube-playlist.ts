/**
 * import_youtube_playlist — bulk-import a YouTube playlist into a channel.
 * Title + duration are scraped from the playlist page in a single request,
 * so this is dramatically faster than calling `add_video` per item. Videos
 * already in the channel are skipped (deduped by youtube_id). Live streams
 * and items without a known duration are skipped — the broadcast schedule
 * needs a real duration.
 */
import { defineTool } from "../lib/tool";
import { jsonContent, requireOwnership } from "../lib/shared";
import {
  extractPlaylistId,
  fetchPlaylistVideos,
  type ScrapedVideo,
} from "@/lib/youtube-playlist";

interface Args {
  channel_id: string;
  playlist_url: string;
  max_videos?: number;
}

export const importYoutubePlaylist = defineTool<Args>({
  definition: {
    name: "import_youtube_playlist",
    description:
      "Import an entire YouTube playlist into a channel. Pass the channel id and a playlist URL (e.g. `https://www.youtube.com/playlist?list=PL...`) or bare playlist id. Title + duration are scraped from the playlist page in a single request — no per-video YouTube fetch — so this is dramatically faster than calling `add_video` per item. Videos already in the channel are skipped (deduped by youtube_id). Returns per-item status. Defaults to importing 50 videos; pass `max_videos` to change (cap 200). Date filtering is not supported.",
    inputSchema: {
      type: "object",
      required: ["channel_id", "playlist_url"],
      properties: {
        channel_id: { type: "string" },
        playlist_url: {
          type: "string",
          description: "YouTube playlist URL or bare list id",
        },
        max_videos: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Max videos to import (default 50)",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const playlistId = extractPlaylistId(args.playlist_url);
    if (!playlistId) {
      throw new Error(
        "Could not extract a playlist id from that URL. Expected format: https://www.youtube.com/playlist?list=PL... or a bare playlist id starting with PL/UU/LL/FL/OL/RD."
      );
    }

    const max = Math.min(Math.max(1, args.max_videos ?? 50), 200);

    const scraped = await fetchPlaylistVideos(playlistId, max);
    if (scraped.length === 0) {
      throw new Error(
        "Playlist returned no videos (it may be private or empty)"
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
    const failed: Array<{
      youtube_id: string;
      title: string;
      reason: string;
    }> = [];

    for (const v of scraped as ScrapedVideo[]) {
      if (existingIds.has(v.youtubeId)) {
        skipped_duplicates.push({
          youtube_id: v.youtubeId,
          title: v.title,
        });
        continue;
      }
      if (v.durationSeconds <= 0) {
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
          thumbnail_url: `https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`,
          duration_seconds: v.durationSeconds,
          position: nextPosition,
        })
        .select("id")
        .single();

      if (error) {
        failed.push({
          youtube_id: v.youtubeId,
          title: v.title,
          reason: error.message,
        });
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
      playlist_id: playlistId,
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
