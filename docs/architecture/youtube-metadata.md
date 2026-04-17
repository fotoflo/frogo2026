# YouTube Metadata

Frogo pulls YouTube metadata (title, duration, thumbnail) in two distinct places, each using a different source:

- **Edit-time metadata** (add/bulk/refresh/import flows) → YouTube **Data API v3** (`src/lib/youtube-api.ts`)
- **Render-time availability filter** (`/watch` server components) → YouTube **oEmbed** (`src/lib/youtube-check.ts`)

They're split on purpose: the Data API gives reliable structured data from Vercel's datacenter IPs (where scraping the watch page hits an EU consent wall), but its quota is finite. oEmbed is unlimited and isn't consent-walled, but only signals availability — it doesn't return duration.

## Key Files

- `src/lib/youtube-api.ts` — single source of truth for Data API calls. Exports `fetchVideoMetadata` (single), `fetchVideoMetadataBatch` (chunks 50/call, parallel), `fetchPlaylistVideos`, `fetchChannelVideos`, `extractYouTubeId`, `extractPlaylistId`, `parseIsoDuration`.
- `src/lib/youtube-check.ts` — oEmbed availability probe used by the watch-page server components to drop unavailable videos before they reach the player. 30-minute in-memory + Next.js fetch cache.
- `src/lib/youtube-playlist.ts` — HTML scraper used only by `search_youtube` (see below).
- `src/app/admin/actions.ts` — `addVideoByUrl` server action (admin UI) calls `fetchVideoMetadata`.
- `src/app/api/mcp/tools/{add-video,add-videos-bulk,refresh-video-metadata,import-youtube-playlist,import-youtube-channel}.ts` — every MCP write tool that touches YouTube metadata goes through `youtube-api.ts`.

## Data API Endpoints Used

| Endpoint | Purpose | Quota cost |
|---|---|---|
| `videos.list?part=snippet,contentDetails,liveStreamingDetails` | Title, duration (ISO 8601), live flag, thumbnails. Accepts up to 50 IDs per call. | 1 unit / call |
| `playlistItems.list?part=contentDetails` | Walks a playlist to collect video IDs (paginated, 50/page). | 1 unit / page |
| `channels.list?part=id&forHandle=@handle` | Resolves a `@handle` to a `UC...` channel id. The uploads playlist is always `UU` + the channel id's tail (no second API call needed). | 1 unit / call |

Default free quota is 10k units/day. Each `add_video` is 1 unit; each `add_videos_bulk` of 50 URLs is 1 unit; each full channel import of 200 videos is ~5 units. Headroom is not the issue.

`search.list` is deliberately NOT used — it's 100 units/call and a single curation session could exhaust the daily quota. `search_youtube` stays on the HTML scraper in `youtube-playlist.ts`.

## `VideoMetadata` Shape

```ts
{
  youtubeId: string;
  title: string;
  durationSeconds: number;   // 0 for live/upcoming — callers MUST skip
  thumbnailUrl: string;      // i.ytimg.com mqdefault
  channelTitle: string;
  publishedAt: string;       // ISO 8601 from snippet.publishedAt
  isLive: boolean;           // snippet.liveBroadcastContent === "live" | "upcoming"
}
```

## Important Patterns

- **Batch everything.** `fetchVideoMetadataBatch` chunks into groups of 50 and fans out chunks in parallel via `Promise.all`. A 200-video channel refresh hits the API 4 times in parallel, costing 4 quota units total.
- **Missing IDs are absent, not errors.** Deleted/private/region-blocked videos simply aren't in the returned `Map`. Each caller decides how to report (`failed` entries in bulk tools; thrown errors in single-video tools).
- **Duration is load-bearing.** `whatsOnNow()` in `src/lib/schedule.ts` sums playlist durations to find the live broadcast edge. Zero or missing duration silently corrupts the schedule for the whole channel. Every write path rejects `isLive || durationSeconds <= 0`.
- **Live streams skipped, not errored.** In bulk paths they land in `failed` with a clear reason so the caller can decide what to do. The single-video `add_video` path throws.
- **Uploads playlist trick.** A YouTube channel's uploads feed is always accessible via `playlistItems.list` with playlist id = channel id with `UC` → `UU`. This avoids a second `search.list` call (100 units) to enumerate channel videos.
- **ISO 8601 parsing is strict.** `parseIsoDuration` matches `PT[H]H[M]M[S]S` only. `P0D` (sometimes returned for active live streams) returns 0, which upstream code treats as "skip".
- **oEmbed is not consent-walled.** `youtube-check.ts` hits `youtube.com/oembed` which returns JSON from all IPs including Vercel's. It only answers "does this video exist" (HTTP 200 vs 404/403), not duration — exactly what the availability filter needs.
- **No retry loop.** A Data API HTTP error throws immediately. The tools that call into batch-mode wrap failures per-item; single-video tools let the error propagate to the MCP response.

## Environment

- `YOUTUBE_API_KEY` — required for every Data API call. Set in Vercel for prod/preview/development, and in `.env.local` for local dev. Missing key throws at first use with an actionable error.

## What's NOT Covered

- **Search** — `search_youtube` uses HTML scraping (`youtube-playlist.ts`) because `search.list` is 100 quota units per call.
- **Render-time availability** — `youtube-check.ts` uses oEmbed because it's free and not consent-walled; we don't need duration at render time (that's already in the DB).
- **Comments, captions, statistics** — none of these are fetched. Frogo doesn't need them.
