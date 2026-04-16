/**
 * add_video — append a YouTube video to a channel's playlist. Title +
 * duration are normally fetched server-side, but callers can pass overrides
 * to bypass YouTube's consent wall (which fires on Vercel datacenter IPs).
 */
import { defineTool } from "../lib/tool";
import { requireOwnership, textContent } from "../lib/shared";
import { fetchVideoMeta } from "@/lib/youtube-meta";

interface Args {
  channel_id: string;
  url: string;
  title?: string;
  duration_seconds?: number;
}

export const addVideo = defineTool<Args>({
  definition: {
    name: "add_video",
    description:
      "Append a YouTube video to a channel's playlist. Accepts any YouTube URL or bare video id. Title + duration are normally fetched from YouTube server-side, but that lookup can fail from Vercel's datacenter IPs (YouTube serves a consent wall). If you already know the title and/or duration, pass them explicitly to bypass the server-side fetch.",
    inputSchema: {
      type: "object",
      required: ["channel_id", "url"],
      properties: {
        channel_id: { type: "string", description: "Target channel uuid" },
        url: { type: "string", description: "YouTube URL or video id" },
        title: {
          type: "string",
          description:
            "Optional override. If provided, skips the title lookup — useful when the server-side fetch is being blocked.",
        },
        duration_seconds: {
          type: "integer",
          description:
            "Optional override. If provided, skips the duration scrape — useful when the server-side fetch is being blocked. MUST be > 0 (required for the broadcast schedule).",
          minimum: 1,
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    await requireOwnership(service, auth.userId, args.channel_id);

    const meta = await fetchVideoMeta(args.url, {
      title: args.title,
      durationSeconds: args.duration_seconds,
    });
    if (!meta) {
      throw new Error(
        "Could not fetch YouTube metadata for that URL. YouTube likely blocked the server-side fetch — retry with `title` and `duration_seconds` passed explicitly."
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
        thumbnail_url: `https://img.youtube.com/vi/${meta.youtubeId}/mqdefault.jpg`,
        duration_seconds: meta.durationSeconds,
        position: nextPosition,
      })
      .select("id, title, position")
      .single();
    if (error) throw new Error(error.message);

    return textContent(
      `Added "${data.title}" at position ${data.position} (video id ${data.id}).`
    );
  },
});
