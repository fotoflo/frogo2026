# TV Mode Architecture

The TV mode is the core experience of Frogo2026. The app behaves like a real television: always on, always fullscreen, always playing. There is no pause, no browse screen, no navigation bar.

## Key Files

- `src/app/watch/[slug]/page.tsx` — server component: fetches all channels + filters videos
- `src/app/watch/[slug]/TVClient.tsx` — client component: all TV playback logic
- `src/components/YouTubePlayer.tsx` — YouTube IFrame API wrapper
- `src/components/OnScreenRemote.tsx` — mini and expanded on-screen remote
- `src/components/MiniQR.tsx` — QR code overlay
- `src/lib/schedule.ts` — broadcast schedule calculation (`whatsOnNow`)
- `src/lib/youtube-check.ts` — oEmbed availability filter
- `scripts/dev.mjs` — dev server with ngrok tunnel

## Page Flow

```
/ (page.tsx)
  └─ redirect to /watch/<first-channel-slug>

/watch/[slug] (page.tsx — server component)
  ├─ Fetch ALL channels + their videos from Supabase in parallel
  ├─ Filter unavailable videos per channel via oEmbed (youtube-check.ts)
  └─ Render TVClient with channels[] + initialChannelIndex

/watch/[slug] (TVClient.tsx — client component)
  ├─ Client-side channel switching (no navigation/page reloads)
  ├─ Calculate current video + startSeconds from schedule
  ├─ Render fullscreen YouTubePlayer
  ├─ Render on-screen chrome (MiniQR, OnScreenRemote, banners)
  └─ Manage pairing session + Supabase Realtime subscription
```

## Client-Side Channel Switching

The server component fetches **all channels at once** and passes them to `TVClient`. Channel switching is pure client-side state — no navigation, no page reloads, no new network requests.

```
page.tsx: channels[] (all channels, all videos, all filtered)
    │
    ▼
TVClient: channelIdx state
    ├─ switchToChannel(idx) — updates state + window.history.replaceState
    ├─ nextChannel() / prevChannel() — wraps around
    └─ switchChannelBySlug(slug) — used by remote commands
```

`window.history.replaceState` keeps the URL in sync for bookmarkability without triggering a navigation.

When the channel changes, `TVClient` detects the new `channel.id` (via a ref comparison), recalculates the broadcast schedule for the new channel's playlist, and shows the channel banner for 4 seconds.

## Broadcast Schedule

Every channel broadcasts on a deterministic schedule anchored to half-hour boundaries. This means any viewer tuning in at the same time sees the same video at the same position — like real TV.

**Logic (`src/lib/schedule.ts` → `whatsOnNow(durations)`):**

1. Take the current UTC timestamp
2. Find the most recent half-hour boundary (e.g., 14:00, 14:30, 15:00)
3. Calculate elapsed seconds since that boundary
4. Walk through the playlist, summing durations, looping as needed
5. Return `{ index, startSeconds }`

This requires no server coordination — every client independently computes the same result from the wall clock.

## Autoplay and Click-to-Start

Browsers block autoplay with sound for videos not yet interacted with. `TVClient` polls the player state every 500ms after mount:

- State `1` (playing) or `3` (buffering): autoplay worked, clear interval
- State `5` (cued) or `-1` (unstarted): autoplay was blocked, show "Click to start" overlay

On screen click: if state is `5` or `-1`, call `player.playVideo()`. If already playing, toggle pause.

## Keyboard Controls

| Key | Action |
|-----|--------|
| ArrowUp | Previous channel |
| ArrowDown | Next channel |
| 0–9 | Buffer digits, switch after 1s of no input |
| Space | Toggle play/pause |
| F | Request fullscreen |
| Escape | Close on-screen remote |

## Fullscreen Player (YouTubePlayer)

`src/components/YouTubePlayer.tsx` uses a singleton IFrame API loader and callback-ref pattern:

- **Singleton API loading**: module-level `ytScriptAdded` flag and `ytReadyCallbacks[]` queue. Only one `<script>` tag is ever appended; all concurrent callers queue callbacks that fire when `onYouTubeIframeAPIReady` fires.
- **Fresh DOM div per mount**: on each `useEffect` mount, a new `<div>` is created and appended to the wrapper ref. This avoids React Strict Mode's double-mount issue where YouTube would try to replace an already-replaced element.
- **Ref-based callbacks**: `onReady`, `onEnded`, `onError`, `onStateChange` are stored in refs so the player can call the latest version without re-creating the player.
- **Video switching**: when `videoId` prop changes after initial mount, calls `player.loadVideoById()` rather than recreating the player.
- Player config: `autoplay:1`, `controls:0`, `rel:0`, `playsinline:1`, `disablekb:1`, `fs:0`, no modestbranding.
- A transparent overlay `<div>` sits on top (`z-10`) to capture mouse events without exposing YouTube UI.

Cleanup destroys the YT player and removes all child DOM nodes from the wrapper.

## On-Screen Chrome

### Visibility Logic
- **Mouse movement**: sets `mouseActive=true`, clears after 450ms of inactivity
- **Channel banner**: shows on channel switch or keyboard digit input; auto-hides after 4s
- `chromeVisible = mouseActive || showBanner`

### MiniQR (`src/components/MiniQR.tsx`)
- Shown only when unpaired (`!paired && pairingCode && sessionId`)
- Hides 10 seconds after chrome goes away (`qrHidden` state + timeout)
- Reappears when chrome becomes visible again
- On pairing, replaced by a small green pulse dot

### OnScreenRemote (`src/components/OnScreenRemote.tsx`)
Two states controlled by `expanded` prop:

**Mini** (mouse hover, `expanded=false`):
- Floating stack in bottom-right: CH+ button, channel number display, play/pause button, CH- button
- Dark backdrop (`bg-black/70 backdrop-blur-sm`)

**Expanded** (`expanded=true`, triggered by clicking the remote or the remote icon):
- Full-screen backdrop overlay
- Channel guide list with ON AIR indicator for the current channel
- Footer with CH+/CH- buttons and Close
- Keyboard hint bar at bottom

`onTogglePlay` prop connects the play/pause button to `TVClient.handleScreenClick()`.

### Channel Banner
- Top-left overlay: channel number, icon, name, current video title
- Shown on initial load (4s), channel switch (4s), and keyboard digit entry

### Now Playing Info
- Bottom-left overlay: channel number, icon, name, video title + description snippet
- Visible whenever `mouseActive || showBanner`

## Video Availability Filtering

YouTube videos can become unavailable (private, deleted, region-locked). To avoid a broken TV experience:

1. **Server-side**: `page.tsx` calls `filterAvailableVideos()` from `youtube-check.ts` for each channel in parallel via `Promise.all`. Each call hits the YouTube oEmbed endpoint; results are cached 30 minutes in-memory.
2. **Runtime**: `YouTubePlayer.onError` triggers `handleError` in `TVClient`, which advances `currentVideoIndex` by 1.

## Dev Server

`scripts/dev.mjs` orchestrates local development:
- Kills any process on port 5555 (`lsof -ti:PORT | xargs kill -9`)
- Deletes `.next` cache directory
- Spawns `next dev -p 5555`
- Loads `NGROK_AUTHTOKEN` from `.env.local` if not in env, then starts ngrok tunnel via `@ngrok/ngrok`
- Writes tunnel URL to `.ngrok-url` file; `/api/tunnel-url` reads this file to serve the URL for QR code generation
- Falls back gracefully if ngrok is not installed or token is missing
