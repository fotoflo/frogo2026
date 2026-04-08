# TV Mode Architecture

The TV mode is the core experience of Frogo2026. The app behaves like a real television: always on, always fullscreen, always playing. There is no pause, no browse screen, no navigation bar.

## Key Files

- `src/app/watch/[slug]/page.tsx` — server component: fetches all channels + filters videos
- `src/app/watch/[slug]/TVClient.tsx` — client component: all TV playback logic
- `src/components/YouTubePlayer.tsx` — YouTube IFrame API wrapper
- `src/components/OnScreenRemote.tsx` — mini and expanded on-screen remote
- `src/components/ClassicHUD.tsx` — classic frogo.tv HUD overlay (channel browser + controls)
- `src/components/MiniQR.tsx` — QR code overlay
- `src/lib/schedule.ts` — broadcast schedule calculation (`whatsOnNow`)
- `src/lib/settings.ts` — feature flags (`FEATURES.CLASSIC_HUD`, etc.)
- `src/app/watch/[slug]/opengraph-image.tsx` — dynamic OG image per channel
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

The TV has two chrome modes, toggled by the `FEATURES.CLASSIC_HUD` flag in `src/lib/settings.ts` (see `docs/architecture/feature-flags.md`):

1. **Classic HUD** (`CLASSIC_HUD: true`) — full overlay modeled after the original frogo.tv (2012-2014)
2. **Minimal Remote** (`CLASSIC_HUD: false`) — lightweight on-screen remote + lower-third info bar

When Classic HUD is active, the minimal remote and broadcast lower-third are hidden. `TVClient` conditionally renders one or the other based on the flag.

### Classic HUD (`src/components/ClassicHUD.tsx`)

A collapsible 3-panel overlay inspired by the original frogo.tv interface. It has three display states managed by `HUDState`: `"expanded"`, `"collapsed"`, and `"minimized"`.

**Panels:**
- **Top Panel** (always visible when not minimized): Frogo logo, current channel number/icon/name, Browse/Close toggle button
- **Middle Content** (expanded only): Left sidebar with channel categories (derived from channel icons) and a right grid of channel tiles with thumbnails. Clicking a tile calls `onSwitchChannel(slug)`
- **Playlist Strip** (collapsed/minimized only): Horizontal scrollable row of video thumbnails for the current channel. Active video marked with "NOW" badge. Clicking a thumbnail calls `onJumpToVideo(index)`
- **Bottom Panel** (always visible): Interactive scrub bar, now-playing info (thumbnail + title + channel), time display, and playback controls (prev/play/next video, prev/next channel, fullscreen)

**Interaction model:**
- Mouse enter on the HUD area transitions from `minimized` to `collapsed`
- Clicking "Browse" expands to full channel browser; clicking "Close" minimizes
- Auto-collapse after 15 seconds of idle in expanded state, then minimizes 2 seconds later
- Scrub bar supports click-and-drag seeking via mousedown/mousemove/mouseup handlers
- Progress polled from YouTube player every 500ms

**Thumbnail validation:**
The playlist strip probes YouTube thumbnails on load. If a thumbnail is 120x90px (YouTube's placeholder for unavailable videos) or fails to load, the video is hidden from the strip via a `badThumbs` Set.

**CSS:** Styles for `.classic-hud`, `.hud-top-panel`, `.hud-content`, `.hud-bottom-panel`, etc. are in `src/app/globals.css`.

### Minimal Remote (legacy default)

#### Visibility Logic
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

## OG Image Generation

`src/app/watch/[slug]/opengraph-image.tsx` produces a 1200x630 PNG for each channel using Next.js `next/og` (file-based metadata convention). This image appears when channel URLs are shared on social platforms.

### Layout
- Full-bleed video thumbnail as background
- Dark gradient overlay (heavier at bottom for readability)
- Centered play button (white circle with triangle)
- Bottom bar: Frogo logo (120px) + channel name (56px bold white)
- 4px purple accent line at the very bottom

### Thumbnail Validation
The `checkImage()` helper validates thumbnails via HTTP HEAD before rendering:
1. Tries `maxresdefault.jpg` first (highest quality YouTube thumbnail)
2. Falls back to `hqdefault.jpg` if maxres fails
3. Rejects responses that are not `image/*` content-type
4. Rejects tiny responses (<2KB) -- YouTube returns small placeholder images for missing thumbnails
5. 3-second timeout per request

Up to 3 additional video thumbnails are validated in parallel from positions 2-6 in the playlist (currently fetched but not rendered in the layout -- reserved for future use).

### Data Flow
1. Fetches channel by slug from Supabase (service client)
2. Fetches first 6 videos ordered by position
3. Validates thumbnail URLs via HEAD requests
4. Renders JSX-to-PNG via `ImageResponse`
5. Revalidates daily (`revalidate = 86400`)

### Important Patterns
- Uses `runtime = "nodejs"` (not Edge) for full Node.js fetch support
- Service client (`createServiceClient()`) for server-side Supabase access
- `AbortSignal.timeout(3000)` prevents slow thumbnail checks from blocking image generation
- Async `params` (Next.js 15+ pattern): `params: Promise<{ slug: string }>`

## Dev Server

`scripts/dev.mjs` orchestrates local development:
- Kills any process on port 5555 (`lsof -ti:PORT | xargs kill -9`)
- Deletes `.next` cache directory
- Spawns `next dev -p 5555`
- Loads `NGROK_AUTHTOKEN` from `.env.local` if not in env, then starts ngrok tunnel via `@ngrok/ngrok`
- Writes tunnel URL to `.ngrok-url` file; `/api/tunnel-url` reads this file to serve the URL for QR code generation
- Falls back gracefully if ngrok is not installed or token is missing
