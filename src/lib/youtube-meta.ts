/**
 * Fetch YouTube video metadata (title, duration, author) without an API key.
 *
 * - Title via noembed.com (oEmbed proxy)
 * - Duration via scraping `"lengthSeconds":"..."` from the watch-page HTML
 *
 * Same pattern as the curate-from-channel skill. Meant for server-side use
 * at edit time (adding a video to a playlist), not for every TV render.
 */

export interface VideoMeta {
  youtubeId: string;
  title: string;
  author: string;
  durationSeconds: number;
}

/**
 * Extract a YouTube video ID from any common URL form or raw ID.
 * Accepts: watch?v=, youtu.be/, shorts/, embed/, or a bare 11-char ID.
 */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  // Bare ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    // youtu.be/VIDEOID
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    // youtube.com/watch?v=VIDEOID
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    // youtube.com/shorts/VIDEOID or /embed/VIDEOID
    const m = url.pathname.match(/\/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    // not a URL
  }
  return null;
}

export interface FetchVideoMetaOptions {
  /** Override: caller-provided title, skips title lookup entirely */
  title?: string;
  /** Override: caller-provided duration in seconds, skips duration lookup */
  durationSeconds?: number;
}

/**
 * Fetches video metadata. `urlOrId` is always required (we need the canonical
 * 11-char id). `options.title` / `options.durationSeconds` can be passed in
 * if the caller already knows them (e.g. the MCP client already has the data
 * from its own YouTube lookup) — this bypasses the server-side fetch, which
 * is unreliable from Vercel's datacenter IPs (YouTube serves consent walls).
 */
export async function fetchVideoMeta(
  urlOrId: string,
  options: FetchVideoMetaOptions = {}
): Promise<VideoMeta | null> {
  const youtubeId = extractYouTubeId(urlOrId);
  if (!youtubeId) {
    console.log("[youtube-meta] no id from input:", urlOrId);
    return null;
  }

  // If the caller supplied both overrides, we're done — no network calls.
  if (options.title && typeof options.durationSeconds === "number") {
    return {
      youtubeId,
      title: options.title,
      author: "",
      durationSeconds: options.durationSeconds,
    };
  }

  const [oembed, scrapedDuration] = await Promise.all([
    options.title ? Promise.resolve(null) : fetchOembed(youtubeId),
    typeof options.durationSeconds === "number"
      ? Promise.resolve(options.durationSeconds)
      : fetchDuration(youtubeId),
  ]);

  const title = options.title ?? oembed?.title ?? null;
  const author = oembed?.author_name ?? "";
  const durationSeconds = scrapedDuration;

  if (!title) {
    console.log("[youtube-meta] title lookup failed:", youtubeId);
    return null;
  }
  if (durationSeconds === null) {
    console.log("[youtube-meta] duration lookup failed:", youtubeId);
    return null;
  }

  return { youtubeId, title, author, durationSeconds };
}

async function fetchOembed(
  youtubeId: string
): Promise<{ title?: string; author_name?: string } | null> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeId}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      console.log("[youtube-meta] noembed status:", res.status, youtubeId);
      return null;
    }
    return (await res.json()) as { title?: string; author_name?: string };
  } catch (err) {
    console.log("[youtube-meta] noembed threw:", youtubeId, err);
    return null;
  }
}

async function fetchDuration(youtubeId: string): Promise<number | null> {
  // hl=en&gl=US bypasses YouTube's EU consent wall, which fires when the
  // request comes from a datacenter IP like Vercel's. Without it, the
  // response is an interstitial page that has no "lengthSeconds".
  const url = `https://www.youtube.com/watch?v=${youtubeId}&hl=en&gl=US`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.log("[youtube-meta] watch status:", res.status, youtubeId);
      return null;
    }
    const html = await res.text();
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    if (!m) {
      // Probably a consent wall or bot-check page.
      console.log(
        "[youtube-meta] lengthSeconds not found, html len:",
        html.length,
        youtubeId
      );
      return null;
    }
    return parseInt(m[1], 10);
  } catch (err) {
    console.log("[youtube-meta] watch threw:", youtubeId, err);
    return null;
  }
}
