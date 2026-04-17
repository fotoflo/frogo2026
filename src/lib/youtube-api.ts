/**
 * YouTube Data API v3 — edit-time metadata fetching.
 *
 * Why this exists: scraping `youtube.com/watch` HTML works locally but fails
 * in prod because Vercel datacenter IPs get served a consent wall. The Data
 * API returns structured JSON with no consent wall. Free quota is 10k
 * units/day; `videos.list` is 1 unit per call regardless of batch size (cap
 * 50 IDs/call), so ~500k video lookups/day.
 *
 * Scope: covers add/bulk/refresh/import flows. Does NOT cover search (100
 * units/call is too expensive) or render-time availability (oEmbed is free
 * and isn't consent-walled).
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Add it to .env.local (dev) and Vercel env vars (prod/preview)."
    );
  }
  return key;
}

/**
 * Extract a YouTube video ID from any common URL form or raw ID.
 * Accepts: watch?v=, youtu.be/, shorts/, embed/, or a bare 11-char ID.
 */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const m = url.pathname.match(/\/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    // not a URL
  }
  return null;
}

export interface VideoMetadata {
  youtubeId: string;
  title: string;
  /** 0 means live/upcoming with no real duration — callers should skip. */
  durationSeconds: number;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  isLive: boolean;
  /** YouTube ToS: must be checked via Data API `status` part. Never defaults to false. */
  madeForKids: boolean;
}

// ─── single + batch video metadata ─────────────────────────────────────────

export async function fetchVideoMetadata(
  youtubeId: string
): Promise<VideoMetadata | null> {
  const map = await fetchVideoMetadataBatch([youtubeId]);
  return map.get(youtubeId) ?? null;
}

/**
 * Batch-fetch metadata. Chunks into groups of 50 (API limit) and fans out in
 * parallel. Missing IDs (deleted/private/region-blocked) are absent from the
 * returned Map — not thrown. 1 quota unit per chunk.
 */
export async function fetchVideoMetadataBatch(
  youtubeIds: string[]
): Promise<Map<string, VideoMetadata>> {
  const out = new Map<string, VideoMetadata>();
  if (youtubeIds.length === 0) return out;

  const chunks: string[][] = [];
  for (let i = 0; i < youtubeIds.length; i += 50) {
    chunks.push(youtubeIds.slice(i, i + 50));
  }

  const results = await Promise.all(chunks.map(fetchVideoChunk));
  for (const chunk of results) {
    for (const meta of chunk) out.set(meta.youtubeId, meta);
  }
  return out;
}

async function fetchVideoChunk(ids: string[]): Promise<VideoMetadata[]> {
  const url = `${API_BASE}/videos?part=snippet,contentDetails,status,liveStreamingDetails&id=${ids.join(",")}&key=${apiKey()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube videos.list HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as VideosListResponse;
  return (data.items ?? []).map(itemToMetadata).filter((m): m is VideoMetadata => m !== null);
}

// ─── playlist ──────────────────────────────────────────────────────────────

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^(PL|UU|LL|FL|OL|RD)[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.searchParams.get("list");
  } catch {
    return null;
  }
}

export async function fetchPlaylistVideos(
  playlistIdOrUrl: string,
  max: number
): Promise<VideoMetadata[]> {
  const playlistId = extractPlaylistId(playlistIdOrUrl);
  if (!playlistId) {
    throw new Error(
      "Could not extract playlist id. Expected https://www.youtube.com/playlist?list=PL... or a bare list id."
    );
  }
  const videoIds = await collectPlaylistVideoIds(playlistId, max);
  return orderedMetadata(videoIds);
}

async function collectPlaylistVideoIds(
  playlistId: string,
  max: number
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const pageSize = Math.min(50, max - ids.length);
    const url =
      `${API_BASE}/playlistItems?part=contentDetails&playlistId=${playlistId}` +
      `&maxResults=${pageSize}${pageToken ? `&pageToken=${pageToken}` : ""}&key=${apiKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `YouTube playlistItems.list HTTP ${res.status}: ${body.slice(0, 200)}`
      );
    }
    const data = (await res.json()) as PlaylistItemsResponse;
    for (const item of data.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return ids.slice(0, max);
}

// ─── channel ───────────────────────────────────────────────────────────────

/** Accepts @handle, UC..., or a full channel URL. */
export async function fetchChannelVideos(
  handleOrIdOrUrl: string,
  max: number
): Promise<VideoMetadata[]> {
  const channelId = await resolveChannelId(handleOrIdOrUrl);
  // Uploads playlist is always the channel id with UC swapped to UU.
  const uploadsPlaylist = "UU" + channelId.slice(2);
  const videoIds = await collectPlaylistVideoIds(uploadsPlaylist, max);
  return orderedMetadata(videoIds);
}

async function resolveChannelId(input: string): Promise<string> {
  const trimmed = input.trim();
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  let handle: string | null = null;
  if (trimmed.startsWith("@")) {
    handle = trimmed;
  } else {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const first = parts[0];
      if (first?.startsWith("@")) handle = first;
      else if (first === "channel" && parts[1]?.startsWith("UC")) return parts[1];
    } catch {
      throw new Error(
        "Could not parse channel input. Use '@handle', a channel id (UC...), or a full URL."
      );
    }
  }
  if (!handle) {
    throw new Error(
      "Could not parse channel input. Use '@handle', a channel id (UC...), or a full URL."
    );
  }

  const url = `${API_BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube channels.list HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as ChannelsListResponse;
  const id = data.items?.[0]?.id;
  if (!id) throw new Error(`No channel found for handle ${handle}`);
  return id;
}

// ─── internals ─────────────────────────────────────────────────────────────

/** Fetches metadata for ids and returns in the same order they were passed. */
async function orderedMetadata(videoIds: string[]): Promise<VideoMetadata[]> {
  const map = await fetchVideoMetadataBatch(videoIds);
  const out: VideoMetadata[] = [];
  for (const id of videoIds) {
    const m = map.get(id);
    if (m) out.push(m);
  }
  return out;
}

function itemToMetadata(item: VideosListItem): VideoMetadata | null {
  if (!item.id || !item.snippet || !item.contentDetails) return null;
  // madeForKids must come from the API — never default to false.
  // If the status part is missing or the field is absent, treat the video
  // as unavailable so the caller fails rather than silently embedding a
  // potentially COPPA-regulated video without proper treatment.
  if (typeof item.status?.madeForKids !== "boolean") return null;
  const live = item.snippet.liveBroadcastContent;
  const isLive = live === "live" || live === "upcoming";
  const durationSeconds = isLive
    ? 0
    : parseIsoDuration(item.contentDetails.duration ?? "");
  return {
    youtubeId: item.id,
    title: item.snippet.title ?? "",
    durationSeconds,
    thumbnailUrl: `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
    channelTitle: item.snippet.channelTitle ?? "",
    publishedAt: item.snippet.publishedAt ?? "",
    isLive,
    madeForKids: item.status.madeForKids,
  };
}

/** PT1H2M3S → 3723. Returns 0 for unparseable input (incl. live `P0D`). */
export function parseIsoDuration(s: string): number {
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const sec = parseInt(m[3] ?? "0", 10);
  return h * 3600 + min * 60 + sec;
}

// ─── API response types ────────────────────────────────────────────────────

interface VideosListItem {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    liveBroadcastContent?: "none" | "live" | "upcoming";
  };
  contentDetails?: { duration?: string };
  status?: { madeForKids?: boolean };
}

interface VideosListResponse {
  items?: VideosListItem[];
}

interface PlaylistItemsResponse {
  items?: { contentDetails?: { videoId?: string } }[];
  nextPageToken?: string;
}

interface ChannelsListResponse {
  items?: { id?: string }[];
}
