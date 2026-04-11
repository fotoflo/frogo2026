# Bug Fix 008: YouTube Metadata Scrape Blocked by EU Consent Wall on Vercel

**Date:** 2026-04-11
**Severity:** High — every MCP `add_video` call failed in production; users could not add videos via Claude.ai at all
**Status:** Fixed

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

## The Fix

Two defenses in depth:

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

## Key Rule

**Don't assume server-side fetches work from datacenter IPs the same way they work from a laptop.** Consumer sites — YouTube, Instagram, TikTok, Twitter, LinkedIn, most e-commerce — actively serve different content to datacenter IP ranges: consent walls, bot checks, captchas, geoblocks, stripped-down mobile variants, or outright 403s. A scrape that works from `localhost` tells you nothing about whether it will work from Vercel, AWS, or any other cloud provider.

Corollaries:

1. **Always set a real User-Agent and `Accept-Language` header on server-side scrapes.** Default fetch UAs get flagged instantly.
2. **When a scraper is load-bearing, always have a client-supplied override path.** The caller often already has the data — let them pass it in and skip the scrape entirely.
3. **Log the length and a short prefix of the HTML body on regex misses.** That's the only way to tell "got the real page but format changed" apart from "got a consent wall / bot check / geoblock interstitial."
4. **Test scrapes against the deployed environment, not just locally.** A passing local test proves nothing about production IP reputation.

---

## Files Involved

- `src/lib/youtube-meta.ts` — added `hl=en&gl=US` query params, Chrome User-Agent + `Accept-Language` headers, and `[youtube-meta]` structured logging at every step of the pipeline
- `src/app/api/mcp/route.ts` — extended the `add_video` tool schema with optional `title` and `duration_seconds`, short-circuiting the YouTube fetch when the caller supplies them
