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

export async function fetchVideoMeta(
  urlOrId: string
): Promise<VideoMeta | null> {
  const youtubeId = extractYouTubeId(urlOrId);
  if (!youtubeId) return null;

  const [title, durationSeconds, author] = await Promise.all([
    fetchTitle(youtubeId),
    fetchDuration(youtubeId),
    fetchAuthor(youtubeId),
  ]);

  if (!title || durationSeconds === null) return null;

  return { youtubeId, title, author: author ?? "", durationSeconds };
}

async function fetchOembed(
  youtubeId: string
): Promise<{ title?: string; author_name?: string } | null> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeId}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return (await res.json()) as { title?: string; author_name?: string };
  } catch {
    return null;
  }
}

async function fetchTitle(youtubeId: string): Promise<string | null> {
  const data = await fetchOembed(youtubeId);
  return data?.title ?? null;
}

async function fetchAuthor(youtubeId: string): Promise<string | null> {
  const data = await fetchOembed(youtubeId);
  return data?.author_name ?? null;
}

async function fetchDuration(youtubeId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    if (!m) return null;
    return parseInt(m[1], 10);
  } catch {
    return null;
  }
}
