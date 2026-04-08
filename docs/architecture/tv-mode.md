# TV Mode Architecture

The TV mode is the core experience of Frogo2026. The app behaves like a real television: always on, always fullscreen, always playing. There is no pause, no browse screen, no navigation bar.

## Page Flow

```
/ (page.tsx)
  └─ redirect to /watch/<first-channel-slug>

/watch/[slug] (page.tsx — server component)
  ├─ Fetch channel + videos from Supabase
  ├─ Filter out unavailable videos via oEmbed (youtube-check.ts)
  └─ Render TVClient with clean playlist

/watch/[slug] (TVClient.tsx — client component)
  ├─ Calculate current video + startSeconds from schedule
  ├─ Render fullscreen YouTubePlayer
  ├─ Render MiniQR overlay
  └─ Render OnScreenRemote overlay
```

## Broadcast Schedule

Every channel broadcasts on a deterministic schedule anchored to half-hour boundaries. This means any viewer tuning in at the same time sees the same video at the same position -- like real TV.

**Logic (`src/lib/schedule.ts`):**

1. Take the current UTC timestamp
2. Find the most recent half-hour boundary (e.g., 14:00, 14:30, 15:00)
3. Calculate elapsed seconds since that boundary
4. Walk through the playlist, summing durations, looping as needed
5. Return the current video index and `startSeconds` offset

This approach requires no server coordination -- every client independently computes the same result from the wall clock.

## Fullscreen Player

`src/components/YouTubePlayer.tsx` renders the YouTube IFrame API player with:
- No native controls (`controls: 0`)
- A transparent overlay div to capture mouse events without hitting YouTube UI
- `startSeconds` parameter so the video begins mid-stream at the scheduled position
- `onError` callback to skip unavailable videos at runtime

The player fills the entire viewport. The `layout.tsx` is stripped to a chromeless shell (no nav bar, no header).

## On-Screen Chrome

Mouse movement triggers a 450ms fade-in of on-screen overlays:

### MiniQR (`src/components/MiniQR.tsx`)
- Small QR code in the corner linking to the pairing URL
- Displays the 4-digit pairing code below it
- Lingers for 10 seconds after the rest of the chrome fades out

### OnScreenRemote (`src/components/OnScreenRemote.tsx`)
- Two states: **mini** (small floating icon) and **expanded** (full channel guide)
- Mini state shows on mouse movement
- Clicking the mini remote expands to a full overlay with:
  - Channel list / guide
  - Current schedule info
  - Channel switching controls

## Video Availability Filtering

YouTube videos can become unavailable (private, deleted, region-locked). To avoid a broken TV experience:

1. **Server-side (build time):** `src/app/watch/[slug]/page.tsx` calls `youtube-check.ts` which hits YouTube's oEmbed endpoint for each video. Unavailable videos are excluded from the playlist before it reaches the client.
2. **Client-side (runtime):** `YouTubePlayer.tsx` has an `onError` handler that skips to the next video if playback fails unexpectedly.

## Dev Server

`scripts/dev.mjs` orchestrates local development:
- Kills any process on the dev port before starting
- Starts the Next.js dev server
- Optionally starts an ngrok tunnel for testing the phone remote on a real device
- The tunnel URL is served via `/api/tunnel-url` so the TV screen can generate QR codes pointing to the public URL
