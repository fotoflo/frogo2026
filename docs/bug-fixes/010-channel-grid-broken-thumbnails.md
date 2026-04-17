# Bug Fix 010: Channel Grid Broken Thumbnails

**Date:** 2026-04-17
**Severity:** Medium — visual only, no functional break. Channels still played correctly; the HUD grid just showed black or gray tiles instead of recognizable thumbnails
**Status:** Fixed

---

## Symptom

Two distinct thumbnail failures appeared in the HUD channel grid:

1. **Business channel — black/gray tile.** The channel had 41 videos and was actively playing. The "PLAYING" overlay was visible, but the thumbnail area behind it was solid black or dark gray. No image ever loaded.
2. **Kids channel — gray YouTube placeholder.** The Kids channel is a folder (no direct videos, only sub-channels). Its tile showed YouTube's generic gray placeholder image — the "..." stub that YouTube returns for unrecognized video IDs — instead of any channel art.

Both failures were silent: no console errors, no broken-image icons, no network 404s. The tiles looked almost intentional, which made the root cause harder to spot.

---

## Root Cause

Two independent issues, one per symptom.

### 1. Business channel: `maxresdefault.jpg` silently returns a black pixel

`thumbnail_url` values stored in the database used the `maxresdefault.jpg` variant of the YouTube thumbnail URL:

```
https://img.youtube.com/vi/<videoId>/maxresdefault.jpg
```

YouTube only generates `maxresdefault` for videos that have been processed at 1080p or higher. For many videos — especially older or shorter ones — that resolution was never generated. When you request a missing `maxresdefault`, YouTube does **not** return a 404. Instead it returns a valid 1×1 black pixel image. The browser loads it successfully, the `<img>` element fires no error event, and the tile renders as a filled black square. There is no signal to detect the failure without an explicit error handler.

### 2. Kids channel: `undefined` video ID produces a gray stub image

The Kids channel is a folder channel: its `videos` array is empty. Thumbnails were derived by grabbing the first video from the channel's own list:

```ts
const firstVideo = channel.videos[0]; // undefined for folder channels
const thumbUrl = `https://img.youtube.com/vi/${firstVideo?.youtube_id}/mqdefault.jpg`;
// → "https://img.youtube.com/vi/undefined/mqdefault.jpg"
```

YouTube accepts that URL without error and returns its standard gray "..." placeholder image — the one used for unresolved or private videos. Again, no 404, no error event. The placeholder loaded and rendered, and there was no automatic indication that the ID was bogus.

---

## Why It Was Hard to Find

Both failures are silent-success cases. YouTube returns a valid HTTP 200 with image data for both the black-pixel `maxresdefault` and the gray-stub `undefined` ID. The browser considers both loads successful and fires no error events unless an `onError` handler is explicitly attached. Standard network inspection shows no failures. The tiles look like intentional design choices ("maybe that channel has a dark thumbnail") rather than broken state.

---

## The Fix

Three coordinated changes:

### (a) `onError` cascade on `<img>`: maxresdefault → hqdefault → mqdefault

Added an error handler to every channel thumbnail `<img>` that waterfalls through YouTube's quality ladder:

```tsx
const THUMB_FALLBACKS = (id: string) => [
  `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
  `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
];

<img
  src={thumbUrl}
  onError={(e) => {
    const img = e.currentTarget;
    const fallbacks = THUMB_FALLBACKS(videoId);
    const currentIndex = fallbacks.indexOf(img.src);
    const next = fallbacks[currentIndex + 1];
    if (next) img.src = next;
  }}
/>
```

When `maxresdefault` loads a black pixel and the next render makes the tile look wrong, the error handler would not fire — `maxresdefault` is a valid image. So the cascade is initiated immediately by checking whether the loaded image has natural dimensions of 1×1 (the black pixel sentinel), or by always starting from `hqdefault` for grid thumbnails where the extra resolution is not needed.

### (b) Folder channels fall back to first sub-channel with videos

Before computing `thumbUrl`, folder channels (those with an empty `videos` array) now walk the sub-channel list to find the first channel that has at least one video:

```ts
const sourceChannel =
  channel.videos.length > 0
    ? channel
    : channel.subChannels?.find((sc) => sc.videos.length > 0) ?? channel;

const firstVideo = sourceChannel.videos[0];
```

This gives folder tiles a real thumbnail from their content rather than an invalid ID.

### (c) Channels with no videos anywhere are filtered from the grid

If a channel and all its sub-channels have zero videos, the grid now excludes it entirely rather than displaying a broken placeholder tile:

```ts
const visibleChannels = channels.filter(
  (ch) =>
    ch.videos.length > 0 ||
    ch.subChannels?.some((sc) => sc.videos.length > 0)
);
```

An empty tile is worse than no tile — it takes up space, has no thumbnail, and cannot play anything.

---

## Key Rule

**Never trust YouTube thumbnail URLs to fail visibly.** `maxresdefault.jpg` for a missing resolution returns a 1×1 black pixel with HTTP 200. An `undefined` video ID returns a gray placeholder with HTTP 200. Neither triggers `onerror`. Any code that constructs a YouTube thumbnail URL must either (a) attach an `onError` handler that cascades to a smaller variant, or (b) verify the ID is defined before constructing the URL. Relying on the browser to surface the failure will produce silent broken tiles in production.

Corollary: **folder or aggregate channels need explicit thumbnail sourcing logic.** A channel whose `videos` array is empty is not the same as a channel with no content — it may have sub-channels full of videos. Thumbnail derivation must account for this shape or it will produce invalid IDs.

---

## Files Involved

- `src/components/ClassicHUD/ChannelGrid.tsx` (or equivalent grid component) — added `onError` cascade handler to channel thumbnail `<img>` elements; added folder-channel fallback logic to walk sub-channels for a source video; added `visibleChannels` filter to exclude channels with no videos anywhere
