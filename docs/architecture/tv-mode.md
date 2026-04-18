# TV Mode Architecture

The TV mode is the core experience of Frogo2026. The app behaves like a real television: always on, always fullscreen, always playing. There is no pause, no browse screen, no navigation bar.

## Key Files

- `src/app/watch/[...slug]/page.tsx` — server component: fetches all channels + filters videos
- `src/app/watch/[...slug]/TVClient.tsx` — client component: all TV playback logic + orchestration
- `src/app/watch/[...slug]/TVOverlays.tsx` — non-interactive TV overlays (QR, mute hint, banner, paired dot)
- `src/components/YouTubePlayer.tsx` — YouTube IFrame API wrapper
- `src/components/OnScreenRemote.tsx` — mini and expanded on-screen remote
- `src/components/ClassicHUD/` — classic frogo.tv HUD overlay (channel browser + controls), split into sub-components
- `src/components/MiniQR.tsx` — QR code card (useSyncExternalStore for origin, 112px size)
- `src/lib/schedule.ts` — broadcast schedule calculation (`whatsOnNow`, retained for future use)
- `src/lib/settings.ts` — feature flags (`FEATURES.CLASSIC_HUD`, etc.)
- `src/lib/useWatchProgress.ts` — URL slug + localStorage + DB position persistence
- `src/lib/useWatchHistory.ts` — fetches seen video IDs per channel; `markSeen` for optimistic updates
- `src/lib/useChromeVisibility.ts` — event-driven QR reconciliation + mouse/banner chrome state + touch support
- `src/lib/useTVKeyboard.ts` — keyboard shortcuts including mute toggle
- `src/lib/mobile-detect.ts` — tablet detection; tablets get TV interface
- `src/app/watch/[slug]/opengraph-image.tsx` — dynamic OG image per channel
- `src/lib/youtube-check.ts` — oEmbed availability filter
- `scripts/dev.mjs` — dev server with ngrok tunnel

## Page Flow

```
/ (page.tsx)
  └─ redirect to /watch/<first-channel-slug>

/watch/[...slug] (page.tsx — server component)
  ├─ Fetch ALL channels + their videos from Supabase in parallel
  ├─ Filter unavailable videos per channel via oEmbed (youtube-check.ts)
  └─ Render TVClient with channels[] + initialChannelIndex

/watch/[...slug] (TVClient.tsx — client component)
  ├─ Client-side channel switching (no navigation/page reloads)
  ├─ readInitialResume() — URL ?v= > localStorage > first video fallback
  ├─ useWatchProgress — 5s URL+localStorage sync, 5min DB sync (PLAYING-gated)
  ├─ useWatchHistory — fetches seen video IDs for the current channel
  ├─ Render fullscreen YouTubePlayer
  ├─ Render TVOverlays (QR, mute hint, banner with channel+video info, paired dot)
  ├─ Render ClassicHUD (channel browser, playlist strip, playback controls)
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

## Playback Start Position

When a viewer opens or switches to a channel, `TVClient` calls `readInitialResume(channelId, videos)` to determine which video to play and at what offset. Three sources are checked in priority order:

1. **URL `?v=slug&t=seconds`** — highest priority; populated every 5 s by `useWatchProgress`. The slug format is `title-words-XXXX` where `XXXX` is the first 4 chars of the video UUID. The slug is resolved back to a full video ID by matching those 4 chars.
2. **`localStorage` `frogo:channel:<channelId>`** — per-channel last-watched position, written every 5 s while the player is in PLAYING state.
3. **First video, position 0** — cold-start fallback.

The prior broadcast schedule (`src/lib/schedule.ts` → `whatsOnNow`) is retained in the codebase for potential future use but is no longer called by `TVClient`.

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
| M | Toggle mute/unmute |
| Escape | Close on-screen remote |

The `m` key calls the optional `onToggleMute` callback wired from `TVClient`. Keys pressed while an `<input>` or `<textarea>` is focused are ignored.

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

### Classic HUD (`src/components/ClassicHUD/`)

A collapsible 3-panel overlay inspired by the original frogo.tv interface. It has three display states managed by `HUDState`: `"expanded"`, `"collapsed"`, and `"minimized"`.

**Folder layout:**
- `index.tsx` — main shell: owns `HUDState`, idle-auto-collapse timers, mouse-enter transitions, and composes the sub-components
- `types.ts` — shared `HUDState` type and prop interfaces used across sub-components
- `useProgress.ts` — custom hook that polls the YouTube player every 500ms for `currentTime`/`duration` and exposes mousedown/move/up scrub handlers; extracted so the shell stays state-free about playback
- `TopPanel.tsx` — logo, channel number/icon/name, breadcrumb trail, QR restore button, Browse/Close toggle
- `Directory.tsx` — left-panel directory navigator (Home, ancestor chain, sub-folder shortcuts)
- `ChannelGrid.tsx` — right-panel responsive grid of channel tiles
- `PlaylistStrip.tsx` — horizontal scrollable video thumbnail row with "NOW" badge and `badThumbs` validation
- `BottomPanel.tsx` — scrub bar, now-playing info, time display, playback controls

**Panels:**
- **Top Panel** (always visible when not minimized): Frogo logo, current channel number/icon/name, breadcrumb trail showing the current scope path, **always-visible search input** (was previously expanded-only), optional QR restore button (when QR was dismissed and phone is unpaired), Browse/Close toggle button
- **Middle Content** (expanded only): Two-column layout — left directory navigator + right channel tile grid. Clicking a tile calls `onSwitchChannel(id)`
- **Playlist Strip** (collapsed/minimized only): Horizontal scrollable row of video thumbnails for the current channel. Active video marked with "NOW" badge. Watched videos show a **green checkmark** badge (bottom-right corner). Clicking a thumbnail calls `onJumpToVideo(index)`. Checkmarks driven by `seenVideoIds` Set from `useWatchHistory`.
- **Bottom Panel** (always visible): Interactive scrub bar, now-playing info (thumbnail + title + channel), time display, and playback controls (prev/**play-pause toggle**/next video, prev/next channel, **copy-link button**, fullscreen). The play/pause button icon toggles based on the `isPlaying` prop.

**Channel Browser Layout (Middle Content):**

The expanded channel browser uses a flex row (`.hud-content`) with two panels:

- **Left Panel** (`.hud-left-panel`, 180px fixed width): A directory navigator that replaces the previous empty breadcrumb area. Contains:
  - A "Directory" section header
  - A "Home" button (navigates to root scope via `onNavigateToScope(null)`)
  - Ancestor chain: each ancestor rendered as an indented button (depth = `12 + (i+1)*10` px left padding). Clicking navigates to that scope
  - Sub-folder shortcuts: sibling channels that have children are listed with a folder icon, indented one level deeper than ancestors
  - The current scope is highlighted with accent color and bold text
  - Scrollable via `.hud-scroll` with custom thin scrollbar

- **Right Panel** (`.hud-right-panel`, flex-grow): Responsive grid of channel tiles (`grid-cols-[repeat(auto-fill,minmax(150px,1fr))]`). Each tile shows:
  - Thumbnail with aspect-video ratio, channel number badge (top-left), folder icon (top-right, if the channel has sub-channels), "PLAYING" pill (centered, for the active channel)
  - Channel name + icon always visible below the thumbnail (no longer hidden until hover)

**ChannelGrid filtering and thumbnail logic (`ChannelGrid.tsx`):**

- **Empty channel filtering**: Channels with no direct videos *and* no sub-channels that have videos are filtered out of the grid before rendering. A channel must satisfy `ch.videos.length > 0 || allChannels.some(c => c.parent_id === ch.id && c.videos.length > 0)` to appear.
- **Folder channel thumbnail fallback**: A channel with no direct videos (a "folder" channel whose content lives in sub-channels) falls back to the first video of its first sub-channel that has videos: `ch.videos[0] ?? allChannels.find(c => c.parent_id === ch.id && c.videos.length > 0)?.videos[0]`. If no video is found at all, the channel's emoji icon is displayed instead.
- **Thumbnail URL resolution**: The tile prefers `firstVideo.thumbnail_url` (from the DB), falling back to `mqdefault` from YouTube (`https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg`).
- **`img` `onError` cascade**: If the initial thumbnail fails to load, the `onError` handler retries in order: `maxresdefault` → `hqdefault` → `mqdefault`. The chain stops at `mqdefault` (no further fallback).

**CSS layout:** The HUD wrapper (`.classic-hud`) uses `display: flex; flex-direction: column` with `max-height: min(70vh, 640px)` when expanded. On wide TVs it centers via `margin-inline: auto` with `max-width: 1800px` (fixes the prior asymmetric left-pinned layout). The middle content area uses `flex: 1 1 auto; min-height: 0; overflow: hidden` so the left and right panels can scroll independently.

**Sizing strategy — Tailwind owns dimensions, CSS owns decoration:**
Responsive sizing lives in the TSX via Tailwind responsive variants (`min-[1600px]:` and `min-[2000px]:`) on each sub-component, so the HUD scales up cleanly on 1600px+ and 2000px+ displays. `globals.css` keeps only decorative styles for `.hud-*` classes — colors, borders, backdrop-filter, custom scrollbars. Fixed widths/heights/padding have been stripped from `.hud-top-panel`, `.hud-bottom-panel`, `.hud-ctrl-btn`, and `.hud-progress-*` so Tailwind utilities take precedence. No `@media` queries for sizing.

**Custom scrollbars:** Both `.hud-left-panel .hud-scroll` and `.hud-right-panel` use thin 6px custom scrollbars (`scrollbar-width: thin`) with translucent white thumbs, replacing chunky native scrollbars.

**Interaction model:**
- Mouse enter on the HUD area transitions from `minimized` to `collapsed`; touch is handled by `useChromeVisibility` listeners
- Clicking "Browse" expands to full channel browser; clicking "Close" minimizes
- Auto-collapse after 15 seconds of idle in expanded state, then minimizes 2 seconds later
- Scrub bar supports click-and-drag seeking via mousedown/mousemove/mouseup, or touch-drag via touchstart/touchmove/touchend (see `useProgress`)
- Progress polled from YouTube player every 500ms via the `useProgress` hook

**Thumbnail validation:**
The playlist strip probes YouTube thumbnails on load. If a thumbnail is 120x90px (YouTube's placeholder for unavailable videos) or fails to load, the video is hidden from the strip via a `badThumbs` Set.

**CSS:** Styles for `.classic-hud`, `.hud-top-panel`, `.hud-content`, `.hud-left-panel`, `.hud-right-panel`, `.hud-channel-tile`, `.hud-bottom-panel`, etc. are in `src/app/globals.css`.

### Touch Support (iPad/Tablet)

Tablets (iPad and Android without "Mobile" token) route to the TV interface via `isMobileRequest()` in `src/lib/mobile-detect.ts`. Touch devices need special handling:

#### Chrome Visibility with Touch (`useChromeVisibility`)
- **Mouse/touch events**: `mousemove`, `touchstart`, and `touchmove` listeners all trigger `keepAlive()`, which sets `mouseActive=true` and resets the inactivity timer (default 2 500 ms).
- **Channel banner**: shows on channel switch or initial load; auto-hides after `bannerMs` (default 4 000 ms). Triggered via `pingBanner()`.
- **QR linger**: QR lingers 30 s after chrome hides; re-appears any time chrome becomes visible. Reconciliation is event-driven — no setState in effects.
- **Touch chrome stay visible**: `@media (pointer: coarse)` in `globals.css` keeps minimized HUD at full opacity (not 0.85) on touch devices, since they can't "hover" to wake it.
- `chromeVisible = mouseActive || showBanner`

#### Touch Scrubbing in BottomPanel
- `useProgress` hook exposes `handleTouchScrubStart` alongside `handleScrubStart`.
- `<div onTouchStart={handleTouchScrubStart}>` on the progress bar fires the same `scrubFromClientX()` logic but using `TouchEvent.touches[0].clientX`.
- Touch move/end listeners use `passive: true` for scroll performance.
- The scrub bar supports both mouse and touch via `touch-none` class to prevent accidental scrolls during scrubbing.

#### Touch-Sized Buttons (`pointer-coarse` variant)
Throughout `ClassicHUD`, Tailwind's `pointer-coarse:` responsive variant scales up buttons and spacing for touch devices:
- Control buttons: `pointer-coarse:w-11 pointer-coarse:h-11` (48px vs. 30px on desktop)
- Icon sizes: `pointer-coarse:w-5 pointer-coarse:h-5` (20px vs. 14px)
- Dividers: `pointer-coarse:h-7` (taller on touch)
- Progress bar: `pointer-coarse:h-[6px]` (thicker), `pointer-coarse:active:h-2.5` (height increases on active)
- Bottom panel spacing: `pointer-coarse:px-4 pointer-coarse:gap-4` (more padding)

### Minimal Remote (legacy default)

#### Visibility Logic (see `useChromeVisibility`)
- **Mouse movement**: sets `mouseActive=true`, clears after `mouseInactiveMs` (default 2 500 ms) of inactivity.
- **Channel banner**: shows on channel switch or initial load; auto-hides after `bannerMs` (default 4 000 ms). Triggered via `pingBanner()`.
- `showQR`: QR lingers 30 s after chrome hides; re-appears any time chrome becomes visible. Reconciliation is event-driven — no setState in effects.
- `chromeVisible = mouseActive || showBanner`

### MiniQR (`src/components/MiniQR.tsx`)
- Shown only when unpaired (`!paired && pairingCode && sessionId && showQR && !qrDismissed`)
- QR size is **112 px** (up from previous 80 px); label reads "pair remote"
- Uses `useSyncExternalStore` to read `window.location.origin` and `.port` — avoids React 19 setState-in-effect lint errors from the previous direct `useEffect` approach
- On pairing, replaced by a small green pulse dot

#### QR Linger Behaviour (`useChromeVisibility`)

Chrome visibility (HUD / lower-third / QR) is driven by `src/lib/useChromeVisibility.ts`:

- Mouse movement → `mouseActive=true`; resets after `mouseInactiveMs` (default 2 500 ms) of no movement.
- Channel switch / initial load → `showBanner=true` for `bannerMs` (default 4 000 ms).
- `showQR = !qrHidden`. The QR **lingers for 30 s** (`qrLingerMs` default) after chrome goes away, so viewers always have a window to pair.
- **Event-driven reconciliation**: `reconcileQr()` is called directly from mouse-event handlers and timeout callbacks — never inside a `useEffect` body. This eliminates React 19 "setState called during render" violations that arise from effects that both read and update state.
- `pingBanner()` is the external API for triggering the banner from `TVClient` on channel switch.

#### QR Dismiss / Restore

Users can dismiss the QR overlay and bring it back later:

- **Dismiss**: Clicking the QR card sets `qrDismissed=true`. A hover state shows an X icon over the QR via a `group-hover` overlay.
- **Restore**: When `qrDismissed` is true and the phone is still unpaired, a QR icon button appears in the Classic HUD top bar (`showQRButton` prop). Clicking it sets `qrDismissed=false`, restoring the QR overlay.
- The `qrDismissed` state is independent of the `qrHidden` auto-fade timer -- both must be false for the QR to show.

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

### Channel Banner (TVOverlays)
- Top-left overlay rendered by `TVOverlays`: Frogo logo + a glassmorphic card showing **channel icon + channel name** on the first line and **current video title** (truncated) below.
- Shown on initial load (4 s) and channel switch (4 s); driven by `showBanner` from `useChromeVisibility`.
- `TVOverlays` receives `bannerChannelName`, `bannerChannelIcon`, `bannerVideoTitle` props from `TVClient` so the overlay knows what to display without reaching into channel state itself.
- A separate channel-number input overlay (`channelNumber` prop) overlays top-left when the user is buffering keyboard digits.

### Now Playing Info
- Bottom-left overlay: channel number, icon, name, video title + description snippet
- Visible whenever `mouseActive || showBanner`

## Video Availability Filtering

YouTube videos can become unavailable (private, deleted, region-locked). To avoid a broken TV experience:

1. **Server-side**: `page.tsx` calls `filterAvailableVideos()` from `youtube-check.ts` for each channel in parallel via `Promise.all`. Each call hits the YouTube oEmbed endpoint; results are cached 30 minutes in-memory.
2. **Runtime**: `YouTubePlayer.onError` triggers `handleError` in `TVClient`, which advances `currentVideoIndex` by 1.

## OG Image Generation

`src/app/watch/[slug]/opengraph-image.tsx` produces a 1200x630 JPEG for each channel using Next.js `next/og` (file-based metadata convention). This image appears when channel URLs are shared on social platforms. See `docs/architecture/og-images.md` for the full caching and compression pipeline.

## Dev Server

`scripts/dev.mjs` orchestrates local development:
- Kills any process on port 5555 (`lsof -ti:PORT | xargs kill -9`)
- Deletes `.next` cache directory
- Spawns `next dev -p 5555`
- Loads `NGROK_AUTHTOKEN` from `.env.local` if not in env, then starts ngrok tunnel via `@ngrok/ngrok`
- Writes tunnel URL to `.ngrok-url` file; `/api/tunnel-url` reads this file to serve the URL for QR code generation
- Falls back gracefully if ngrok is not installed or token is missing
