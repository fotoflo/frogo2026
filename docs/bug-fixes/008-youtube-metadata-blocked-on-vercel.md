# Bug Fix 008: YouTube Metadata Scrape Blocked by EU Consent Wall on Vercel

**Date:** 2026-04-11 (workaround) / 2026-04-16 (permanent fix in `e3961b0`)
**Severity:** High — every MCP `add_video` call failed in production; users could not add videos via Claude.ai at all
**Status:** Fixed (permanent — migrated off HTML scraping to YouTube Data API v3)

---

## Symptom

A user ran a batch of 10 `add_video` calls through the frogotv MCP server from Claude.ai. Every single one failed with the same generic error:

> Could not fetch YouTube metadata for that URL

All 10 videos in the batch errored. The same URLs worked fine when added through the admin UI on a laptop and worked fine when the MCP code was run locally against `pnpm run dev` — the failures were exclusive to the deployed Vercel environment.

---

## Root Cause

`src/lib/youtube-meta.ts`'s `fetchDuration()` scrapes the public YouTube watch page to pull the video length:

```ts
// roughly — before
const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
const html = await res.text();
const match = html.match(/"lengthSeconds":"(\d+)"/);
```

From a residential IP (laptop, home network), YouTube serves the normal ~1MB watch page and the regex matches cleanly. From Vercel's datacenter IPs, YouTube's geo/IP heuristics decide the request is coming from the EU and instead serve the **consent wall interstitial** — a stripped-down HTML page asking the user to accept cookies before showing the video. That interstitial contains no `"lengthSeconds"` field anywhere, so the regex misses, `fetchDuration()` returns null, `fetchVideoMeta()` returns null, and the MCP tool throws its generic "Could not fetch YouTube metadata" error.

Two things compounded the diagnosis:

1. The failure mode was silent — the regex just didn't match, no exception was thrown, so there was nothing in logs explaining *which* step of the metadata fetch failed.
2. oEmbed (`https://www.youtube.com/oembed?url=...`) kept working from Vercel, so partial metadata (title, thumbnail) came back fine and the failure looked inconsistent — title worked, duration didn't.

---

## Why It Was Hard to Find

1. **"Works on my machine" in the most literal way.** Local dev, admin UI, and any manual test from a laptop all worked. Only Vercel's production IPs hit the consent wall, and nobody on the team had instrumented the scrape to log what HTML it was actually getting back.
2. **The error message was generic.** "Could not fetch YouTube metadata for that URL" could mean oembed failed, watch-page fetch failed, regex missed, network timeout, rate limit — anything. There was no structured logging pointing at a specific step.
3. **oEmbed still worked.** Because title and thumbnail came back fine from the oEmbed endpoint, it wasn't obvious that the watch-page scrape was the broken half. It looked like an intermittent YouTube flake, not a systematic block.
4. **No visibility into the response body.** YouTube returned a clean `200 OK` with a full HTML body — it just happened to be the consent interstitial instead of the real watch page. From `fetch()`'s point of view nothing was wrong.
5. **Geo-dependent, IP-dependent behavior.** Reproducing required actually running the fetch from a datacenter IP. Anything tested locally, over VPN to a US residential exit, or via curl from a dev machine would hide the bug.

---

## Initial Workaround (2026-04-11)

Two defenses in depth were deployed as an immediate mitigation while a proper fix was scoped:

### 1. Force the non-EU watch page variant

Append `&hl=en&gl=US` to the watch URL and send headers that look like a real Chrome browser, including `Accept-Language: en-US`. The combination convinces YouTube to serve the US version of the page (which has no consent wall) even when the request comes from a Vercel datacenter IP.

```ts
// src/lib/youtube-meta.ts — after
const res = await fetch(
  `https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`,
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  },
);
```

With those headers, the scrape gets the real ~1MB page and `"lengthSeconds"` is present again.

### 2. Escape hatch: client-supplied metadata

Even with the header workaround, scraping YouTube is fundamentally fragile — they can change the page, tighten the heuristics, or serve bot checks at any time. So `add_video` now accepts optional `title` and `duration_seconds` arguments:

```ts
// src/app/api/mcp/route.ts — add_video tool
{
  name: "add_video",
  inputSchema: {
    type: "object",
    properties: {
      channel_slug: { type: "string" },
      url: { type: "string" },
      title: { type: "string" },              // optional
      duration_seconds: { type: "number" },   // optional
    },
    required: ["channel_slug", "url"],
  },
}
```

When the caller provides `title` and `duration_seconds`, the server-side YouTube fetch is skipped entirely — the values are trusted and written straight to the row. The MCP client (Claude.ai, or any other caller) can supply metadata it already has from its own context, which means a scrape failure no longer blocks the write path.

### 3. Structured logging

Added `[youtube-meta]` prefixed logs at every step of the pipeline:

- oEmbed network call (success / HTTP error / timeout)
- Watch-page network call (success / HTTP error / timeout)
- Regex match attempt (matched / missed, with a length prefix of the HTML body)
- Final merged result returned to the caller

Future failures will say exactly which step broke — "oembed 200 ok, watch 200 ok, regex missed on 34KB body" points immediately at a consent-wall-style interstitial without needing to reproduce the bug live.

---

## Permanent Fix (2026-04-16, commit `e3961b0`)

The workaround was fragile by construction — it relied on YouTube continuing to honor `hl=en&gl=US` + a Chrome UA from datacenter IPs, which is a heuristic that can silently regress at any time. The real fix is to stop scraping `youtube.com/watch` entirely for edit-time metadata and use the officially supported YouTube Data API v3 instead.

### New module: `src/lib/youtube-api.ts`

A thin wrapper around the three Data API v3 endpoints we actually need:

- `videos.list` (part=`snippet,contentDetails`) — title, channel name, thumbnail, ISO-8601 duration. **Batches up to 50 video IDs per call.**
- `playlistItems.list` — walks a playlist and returns the contained video IDs, paginated.
- `channels.list` — resolves a channel handle / URL to its uploads playlist ID.

Each call costs **1 quota unit** (default daily quota: 10,000 units). Durations come back as ISO-8601 strings (`PT1H2M3S`) and are parsed to seconds inside the module. Missing/deleted/private videos simply don't appear in the response, so filtering is a natural side effect of the batch call.

### Migrated callers

All edit-time metadata paths now go through `youtube-api.ts`:

- `add_video` (MCP tool)
- `add_videos_bulk` (MCP tool)
- `refresh_video_metadata` (MCP tool)
- `import_youtube_channel` (MCP tool) — resolves handle → uploads playlist → paginated `playlistItems.list` → batched `videos.list`
- `import_youtube_playlist` (MCP tool) — paginated `playlistItems.list` → batched `videos.list`
- `addVideoByUrl` in `src/app/admin/actions.ts` — admin UI form submission

The bulk paths benefit most: importing a 200-video playlist is now 4 `playlistItems.list` calls + 4 `videos.list` calls = 8 quota units total, vs. 200 separate HTML scrapes before.

### Removed: client-supplied override params

The Data API never gets consent-walled, so the workaround escape hatch is no longer needed. The `title` and `duration_seconds` parameters have been **removed from `add_video`'s input schema**. The tool is now `{ channel_slug, url }` again — simpler for callers, and there's no ambiguous "trust the client" path to reason about.

### Deleted: `src/lib/youtube-meta.ts`

The old HTML scraper module is gone. All its callers were migrated; it had no remaining consumers.

### Deliberately kept on scrapers

Two paths intentionally did **not** migrate:

1. **`search_youtube` MCP tool** — uses `search.list`, which costs **100 quota units per call**. At the default 10,000 unit daily budget, that's only 100 searches/day. The scraper-based search is kept because it's free and search results don't need to be perfectly accurate (humans filter them).
2. **Render-time `src/lib/youtube-check.ts`** — uses the public oEmbed endpoint (`/oembed?url=...`), which is **not consent-walled** (it was the half of the old pipeline that kept working from Vercel) and has no quota. It runs on every page render to filter unavailable videos, so putting it on the Data API would burn quota fast.

The rule is: **edit-time writes go through the Data API (authoritative, cheap per item, batched); read-time checks stay on oEmbed (free, unlimited, already working).**

### Configuration

Requires a new env var: `YOUTUBE_API_KEY` (Google Cloud Console → YouTube Data API v3 → API key). It's set in:

- `.env.local` (dev)
- Vercel: Production, Preview, Development scopes

The key is server-side only — never exposed to the client.

---

## Key Rule

**Never scrape `youtube.com/watch` from a datacenter IP — use the YouTube Data API v3.** Consumer sites actively discriminate against datacenter IP ranges with consent walls, bot checks, captchas, geoblocks, and stripped-down interstitials. A scrape that works from `localhost` tells you nothing about whether it will work from Vercel, AWS, or any other cloud provider. When there's an official API, use it.

Corollaries:

1. **Prefer official APIs to HTML scraping for any load-bearing path.** Scrapers are a stopgap, not a permanent solution.
2. **Batch API calls when the endpoint supports it.** `videos.list` takes 50 IDs per call for 1 quota unit — single-ID calls waste 50x quota.
3. **Pick the cheap endpoint.** `search.list` is 100 units; `videos.list` / `playlistItems.list` / `channels.list` are 1 unit each. Quota matters.
4. **Separate read-time from edit-time.** High-volume read paths (every page render) can stay on free unauthenticated endpoints like oEmbed; edit-time writes go through the authoritative API.
5. **If you must scrape, set a real User-Agent and `Accept-Language` header**, log response body length on regex misses, and test against the deployed environment — but treat it as tech debt, not a solution.

---

## Files Involved

### Permanent fix (2026-04-16)

- `src/lib/youtube-api.ts` — **new**, wraps `videos.list` / `playlistItems.list` / `channels.list` with batching and ISO-8601 duration parsing
- `src/lib/youtube-meta.ts` — **deleted**, obsolete HTML scraper
- `src/app/api/mcp/route.ts` and per-tool modules — `add_video`, `add_videos_bulk`, `refresh_video_metadata`, `import_youtube_channel`, `import_youtube_playlist` migrated to `youtube-api.ts`; removed `title` and `duration_seconds` params from `add_video`
- `src/app/admin/actions.ts` — `addVideoByUrl` migrated to `youtube-api.ts`
- `.env.local` + Vercel env (Prod / Preview / Dev) — added `YOUTUBE_API_KEY`

### Initial workaround (2026-04-11, superseded)

- `src/lib/youtube-meta.ts` — added `hl=en&gl=US` query params, Chrome User-Agent + `Accept-Language` headers, and `[youtube-meta]` structured logging (file now deleted)
- `src/app/api/mcp/route.ts` — extended `add_video` tool schema with optional `title` and `duration_seconds` (params now removed)
