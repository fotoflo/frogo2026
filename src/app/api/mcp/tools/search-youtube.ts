/**
 * search_youtube — discover YouTube videos by query. Scrapes YouTube's
 * results page (no API key required) and returns id/title/duration/author/url
 * so results can be piped into `add_video` or `add_videos_bulk`. Optional
 * `min_length_seconds` filter drops Shorts and short clips. This is a
 * read-only tool — no DB writes, no ownership checks beyond the bearer-token
 * scope already enforced by the MCP route.
 */
import { defineTool } from "../lib/tool";
import { jsonContent } from "../lib/shared";
import { searchYouTube, type ScrapedVideo } from "@/lib/youtube-playlist";

interface Args {
  query: string;
  max_results?: number;
  min_length_seconds?: number;
}

export const searchYoutubeTool = defineTool<Args>({
  definition: {
    name: "search_youtube",
    description:
      "Search YouTube for videos matching a query. Returns id/title/duration/author/url so results can be piped into `add_video` or `add_videos_bulk`. `min_length_seconds` filters out shorts and clips (e.g. 60 to drop YouTube Shorts, 300 to require ≥5min content). Default returns 10 results, cap 50. Note: this scrapes YouTube's HTML so results can be flaky if YouTube changes their layout — use `import_youtube_playlist` if you have a known playlist.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          minLength: 1,
          description: "YouTube search query",
        },
        max_results: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: "Max results returned (default 10, cap 50)",
        },
        min_length_seconds: {
          type: "integer",
          minimum: 1,
          description: "Drop results shorter than this (e.g. 60 to skip Shorts)",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(_service, _auth, args) {
    const q = (args.query ?? "").trim();
    if (!q) throw new Error("`query` cannot be empty");

    const maxResults = Math.min(Math.max(1, args.max_results ?? 10), 50);
    const minLength = args.min_length_seconds ?? 0;

    const fetchPool = minLength > 0 ? Math.min(maxResults * 4, 50) : maxResults;
    const scraped: ScrapedVideo[] = await searchYouTube(q, fetchPool);

    const filtered = scraped
      .filter((v) => v.durationSeconds >= minLength)
      .slice(0, maxResults);

    const result = filtered.map((v) => ({
      youtube_id: v.youtubeId,
      url: `https://www.youtube.com/watch?v=${v.youtubeId}`,
      title: v.title,
      duration_seconds: v.durationSeconds,
      author: v.author,
    }));

    return jsonContent({
      query: q,
      count: result.length,
      min_length_seconds: minLength,
      results: result,
    });
  },
});
