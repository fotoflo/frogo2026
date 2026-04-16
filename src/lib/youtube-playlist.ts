/**
 * Scrape YouTube playlists, channel video lists, and search results without
 * an API key. All three endpoints embed a `var ytInitialData = {...};` blob
 * that contains the same "video renderer" shapes — we walk it generically.
 *
 * Same datacenter-IP caveat as youtube-meta.ts: we send a real User-Agent and
 * `hl=en&gl=US` to bypass the EU consent wall that fires on Vercel's IPs.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const COMMON_HEADERS = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
};

export interface ScrapedVideo {
  youtubeId: string;
  title: string;
  /** 0 means unknown (live streams, upcoming, or YouTube didn't expose it) */
  durationSeconds: number;
  /** Channel name as shown by YouTube; "" if unavailable */
  author: string;
}

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^(PL|UU|LL|FL|OL|RD)[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    /* not a URL */
  }
  return null;
}

export async function fetchPlaylistVideos(
  playlistId: string,
  max: number
): Promise<ScrapedVideo[]> {
  const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=en&gl=US`;
  const html = await fetchHtml(url);
  const data = extractInitialData(html);
  return walkForVideos(data, max);
}

export async function fetchChannelVideos(
  handleOrUrl: string,
  max: number
): Promise<ScrapedVideo[]> {
  const url = resolveChannelVideosUrl(handleOrUrl);
  const html = await fetchHtml(url);
  const data = extractInitialData(html);
  return walkForVideos(data, max);
}

export async function searchYouTube(
  query: string,
  max: number
): Promise<ScrapedVideo[]> {
  // sp=EgIQAQ%3D%3D restricts results to videos (no channels/playlists).
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D&hl=en&gl=US`;
  const html = await fetchHtml(url);
  const data = extractInitialData(html);
  return walkForVideos(data, max);
}

// ─── internals ─────────────────────────────────────────────────────────────

function resolveChannelVideosUrl(input: string): string {
  const trimmed = input.trim();
  let base: string;
  if (trimmed.startsWith("@")) {
    base = `https://www.youtube.com/${trimmed}/videos`;
  } else if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    base = `https://www.youtube.com/channel/${trimmed}/videos`;
  } else {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(
        "Could not parse channel URL or handle. Use '@handle', a channel id (UC...), or a full URL."
      );
    }
    const path = parsed.pathname.replace(/\/+$/, "");
    base = path.endsWith("/videos")
      ? `${parsed.origin}${path}`
      : `${parsed.origin}${path}/videos`;
  }
  return `${base}?hl=en&gl=US`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: COMMON_HEADERS, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`YouTube returned HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function extractInitialData(html: string): unknown {
  // The blob ends with `;</script>`. Use a non-greedy match and stop at the
  // closing tag — JSON content can contain `</` in escaped strings, so we
  // can't rely on `</script>` as a delimiter alone, but `;</script>` is the
  // canonical YouTube signature.
  const m = html.match(/var ytInitialData = (\{[\s\S]+?\});<\/script>/);
  if (!m) {
    throw new Error(
      "Could not find ytInitialData on the YouTube page (likely a consent wall or bot-check). Try again later."
    );
  }
  try {
    return JSON.parse(m[1]);
  } catch (err) {
    throw new Error(
      `Failed to parse ytInitialData JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

interface RawVideoRenderer {
  videoId?: string;
  title?: { runs?: { text?: string }[]; simpleText?: string };
  lengthText?: { simpleText?: string; runs?: { text?: string }[] };
  lengthSeconds?: string;
  ownerText?: { runs?: { text?: string }[] };
  shortBylineText?: { runs?: { text?: string }[] };
  longBylineText?: { runs?: { text?: string }[] };
}

function walkForVideos(root: unknown, max: number): ScrapedVideo[] {
  const seen = new Set<string>();
  const out: ScrapedVideo[] = [];

  const visit = (node: unknown): void => {
    if (out.length >= max || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (out.length >= max) return;
        visit(item);
      }
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    for (const key of [
      "playlistVideoRenderer",
      "videoRenderer",
      "gridVideoRenderer",
      "compactVideoRenderer",
    ]) {
      const r = obj[key] as RawVideoRenderer | undefined;
      if (r && typeof r === "object" && r.videoId) {
        const id = r.videoId;
        if (!seen.has(id)) {
          const title =
            r.title?.runs?.[0]?.text ?? r.title?.simpleText ?? "";
          const durationSeconds = parseDuration(r);
          const author =
            r.ownerText?.runs?.[0]?.text ??
            r.shortBylineText?.runs?.[0]?.text ??
            r.longBylineText?.runs?.[0]?.text ??
            "";
          if (id && title) {
            seen.add(id);
            out.push({ youtubeId: id, title, durationSeconds, author });
            if (out.length >= max) return;
          }
        }
      }
    }

    for (const key in obj) visit(obj[key]);
  };

  visit(root);
  return out;
}

function parseDuration(r: RawVideoRenderer): number {
  if (r.lengthSeconds) {
    const n = parseInt(r.lengthSeconds, 10);
    if (!isNaN(n)) return n;
  }
  const text =
    r.lengthText?.simpleText ?? r.lengthText?.runs?.[0]?.text ?? "";
  return parseLengthText(text);
}

export function parseLengthText(s: string): number {
  if (!s) return 0;
  const parts = s.trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  let total = 0;
  for (const p of parts) total = total * 60 + p;
  return total;
}
