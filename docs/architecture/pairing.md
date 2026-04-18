# Pairing and Remote Control Architecture

Frogo2026 pairs a TV (desktop browser) with a phone remote, similar to how Chromecast or Apple TV pairing works. The phone acts as a channel remote — not a media controller.

## Key Files

### TV-side pairing
- `src/app/watch/[slug]/TVClient.tsx` — creates pairing session, holds Realtime subscription, handles commands
- `src/components/MiniQR.tsx` — QR code overlay on TV screen

### Phone remote (new architecture)
- `src/app/pair/page.tsx` — entry point; renders `PairScreen` (pre-pair) or `RemoteShell` (paired)
- `src/app/pair/layout.tsx` — font imports (Space Grotesk, Manrope, Material Symbols); exports viewport config with `viewportFit=cover` for iOS safe area handling
- `src/app/manifest.ts` — PWA web manifest enabling standalone mode (`display: standalone`) so users can add `/pair` to home screen and run without browser chrome
- `src/app/pair/RemoteShell.tsx` — main remote container; manages state, tabs, panels; toast notifications; swipe gestures
- `src/app/pair/PairScreen.tsx` — code entry UI (pre-pairing)
- `src/app/pair/NowPlayingHero.tsx` — displays video thumbnail, title, channel, playback state, progress bar, action buttons
- `src/app/pair/DPad.tsx` — D-pad disc (4-way + center), volume rocker, channel rocker
- `src/app/pair/BentoGrid.tsx` — 4-tile grid: Search, Browse, Favorites, Recent (toggle panels)
- `src/app/pair/SearchPanel.tsx` — search input, results, navigate by channel
- `src/app/pair/ChannelBrowser.tsx` — full tree directory with search/filter
- `src/app/pair/ChannelGuide.tsx` — channel guide tab content
- `src/app/pair/FavoritesList.tsx` — saved channels panel
- `src/app/pair/RecentChannels.tsx` — recently viewed channels panel
- `src/app/pair/BottomNav.tsx` — tab navigation (Remote / Guide / Chat)
- `src/app/pair/ReactionBar.tsx` — emoji reactions (displays on TV via `ReactionOverlay`)
- `src/app/pair/ChatInput.tsx` — text message input (displays on TV via `ChatOverlay`)
- `src/app/pair/TransportBar.tsx` — skip previous/next buttons (integrated into RemoteShell)
- `src/app/pair/ShareButton.tsx` — copy video URL; integrated into `NowPlayingHero`
- `src/app/pair/VolumeRocker.tsx` — volume controls (integrated into `DPad`)
- `src/app/pair/ChannelRocker.tsx` — channel controls (integrated into `DPad`)

### Phone remote hooks & utilities
- `src/app/pair/useRemoteState.ts` — subscribes to pairing session Realtime; fetches video/channel metadata
- `src/app/pair/useFavorites.ts` — save/load favorites from localStorage + server
- `src/app/pair/useSwipeGestures.ts` — attach swipe listeners to D-pad container
- `src/lib/usePairingSync.ts` — keeps pairing session state in sync (desktop ↔ mobile)
- `src/lib/useReactions.ts` — send/subscribe to emoji reactions
- `src/lib/useChatMessages.ts` — send/subscribe to chat messages

### Phone remote overlays
- `src/components/ReactionOverlay.tsx` — displays incoming emoji reactions on TV
- `src/components/ChatOverlay.tsx` — displays incoming messages on TV

### API endpoints
- `src/app/api/pair/route.ts` — POST creates pairing session, returns `{ code, sessionId }`
- `src/app/api/pair/join/route.ts` — POST looks up session by code, marks `paired=true`
- `src/app/api/pair/state/route.ts` — GET returns current TV state (video, channel, position, playback state)
- `src/app/api/tunnel-url/route.ts` — GET returns ngrok URL from `.ngrok-url` file
- `src/app/api/network-ip/route.ts` — GET returns LAN IP as fallback
- `src/app/api/channels/guide/route.ts` — GET returns full channel tree for guide
- `src/app/api/favorites/route.ts` — GET/POST favorites
- `src/app/api/history/recent/route.ts` — GET recently viewed channels

### Testing
- `src/lib/pairing.e2e.test.ts` — e2e tests for the full pairing lifecycle

## Pairing Flow

```
┌──────────┐                              ┌──────────┐
│  TV      │                              │  Phone   │
│  Screen  │                              │  Browser │
└────┬─────┘                              └────┬─────┘
     │                                         │
     │  1. TVClient POSTs /api/pair on mount   │
     │     → 4-digit code + session UUID        │
     │     stored in pairing_sessions table     │
     │                                         │
     │  2. TV displays MiniQR (QR + code)       │
     │                                         │
     │                          3. User scans  │
     │                             QR or types  │
     │                             code at /pair│
     │                                         │
     │  4. Phone POSTs /api/pair/join           │
     │     → session marked paired=true         │
     │     → phone gets sessionId               │
     │                                         │
     │◄──────── Supabase Realtime ────────────►│
     │     TV: postgres_changes UPDATE          │
     │         on pairing_sessions row          │
     │                                         │
     │  5. Phone writes last_command +          │
     │     last_command_at directly to          │
     │     Supabase (anon client)               │
     │                                         │
     │  6. TV Realtime fires, deduplicates      │
     │     by last_command_at, calls            │
     │     handleCommand(last_command)           │
     │                                         │
```

## Command Deduplication

The TV deduplicates commands using a ref:

```ts
const lastCommandAtRef = useRef<string | null>(null);
// In Realtime handler:
if (newRow.last_command_at !== lastCommandAtRef.current) {
  lastCommandAtRef.current = newRow.last_command_at;
  handleCommand(newRow.last_command);
}
```

This prevents the same command from firing twice if the Realtime subscription reconnects or the effect re-runs.

## Realtime Subscription Lifecycle

`TVClient` creates **one persistent Realtime subscription** after the pairing session is created. The subscription is never torn down on channel switches (because `TVClient` never unmounts — channel switching is pure state). It is only cleaned up when the component unmounts (browser tab close/navigate away).

Subscription channel name: `pairing:${sessionId}`, filtering on `pairing_sessions.id = sessionId`.

## Commands Reference

| Command | Action |
|---------|--------|
| `next` | Next channel (wraps around) |
| `prev` | Previous channel (wraps around) |
| `channel_1` … `channel_9` | Jump to channel by 1-based number |
| `navigate_{slug}` | Jump to channel by slug (used by search results) |

There is no play/pause command — the TV is always broadcasting. The phone remote also does not expose volume.

## QR Code URL Resolution

The TV screen needs a URL that the phone can reach. `MiniQR` resolves the host in priority order:

1. `/api/tunnel-url` — ngrok URL written to `.ngrok-url` by `scripts/dev.mjs` (works cross-network)
2. `/api/network-ip` — LAN IP (works on same WiFi)
3. `window.location.host` — localhost fallback

`MiniQR` uses `useSyncExternalStore` (not `useEffect`) to read `window.location.origin` and `.port`, avoiding React 19 setState-in-effect lint errors.

The QR code encodes `https://<host>/pair?code=XXXX`. Scanning it opens `/pair` with the code pre-filled, triggering auto-pair on mount.

### QR Visibility Behaviour

- QR card is **112 px** wide with rounded dots style; label reads "pair remote".
- Visibility is controlled by `showQR` from `useChromeVisibility` (see [TV Mode](tv-mode.md)).
- The QR lingers **30 s** after chrome hides, giving viewers time to scan even after they stop moving the mouse.
- The QR re-appears automatically every ~3 min while the TV remains unpaired.
- Users can dismiss the QR by clicking it; a restore button appears in the HUD top bar when dismissed.

## Phone Remote UI (`/pair`)

The phone remote is a full-featured control and information center for the TV. Built with a glass-morphism design (semi-transparent, blurred, accent-colored borders) using Material Symbols icons and Manrope/Space Grotesk typography.

### Pre-pairing screen (`PairScreen.tsx`)
- 4-digit numeric input with large font
- Animated slide-up transitions
- Debug log panel showing request/response details
- Auto-pairs immediately if `?code=XXXX` is in the URL (from QR scan)

### Post-pairing remote layout (`RemoteShell.tsx`)

The remote is built as a tabbed interface with three main sections. The `/pair` page is PWA-ready with a web manifest (`src/app/manifest.ts`) that enables `display: standalone`, allowing users to install it to their home screen. When run as an installed app, the Safari URL bar is hidden and safe-area insets are respected via `viewportFit=cover` in the layout viewport config.

#### Main Header
- **Frogo logo image** (left) — app branding
- **"LIVE" / "..."** status indicator (center/right, green pulse when connected)
- **Unpair button** (top right) — clears all state and returns to code entry screen

#### Now Playing Hero (`NowPlayingHero.tsx`)
- Large thumbnail with playback state badge ("LIVE" or "PAUSED")
- Video title + channel name/icon
- Live progress bar (green gradient, 1px height) showing remaining time
- Action buttons: watch on mobile, share, favorite (★/☆)
- Shows "Waiting for TV…" when `loading=true` or no video yet

#### Three-tab navigation (`BottomNav.tsx`)
1. **Remote** — main control interface
2. **Guide** — channel directory with browsing
3. **Chat** — send messages to the TV (displayed as `ChatOverlay`)

### Remote Tab Controls

#### D-Pad disc (`DPad.tsx`)
- Center: **Play/Pause** button (green accented, shows current state)
- Cardinal directions:
  - **↑ Up** — previous channel (`prev`)
  - **↓ Down** — next channel (`next`)
  - **← Left** — previous video in playlist (`video_prev`)
  - **→ Right** — next video in playlist (`video_next`)
- **Left rocker** (Vol ±): volume up/down, mute toggle
- **Right rocker** (Ch ±): channel up/down (duplicates D-pad vertical, for traditional TV feel)

#### Bento Grid (`BentoGrid.tsx`)
Four interactive tiles that toggle expandable panels:
- **Search** — debounced 300ms search via `/api/search?q=`
- **Browse** — full channel directory browser
- **Favorites** — saved channels (persisted to localStorage via `useFavorites`)
- **Recent** — recently watched channels (from `useRemoteState`)

#### Transport section
- **Skip Previous** (`video_prev`) and **Skip Next** (`video_next`) buttons for video-level control

#### Expandable panels (mutually exclusive)
- **SearchPanel** — live search results that navigate via `navigate_{slug}` command
- **ChannelBrowser** — tree-based channel directory
- **FavoritesList** — saved favorites with toggle
- **RecentChannels** — last viewed channels
- **ReactionBar** — send emoji reactions to the TV (appears on `ReactionOverlay`)

#### Chat input
- Text input for messages (displayed on TV via `ChatOverlay`)
- Shows "Messages appear on the TV screen"

### Guide Tab (`ChannelGuide.tsx`)
- Full-screen channel directory
- Highlights current channel
- Navigate by `navigate_{slug}` command

#### Toast notifications
- 1.5-second overlay at top of screen showing:
  - Command sent (green, `#cbff72`)
  - Supabase errors (red prefix "ERR: ")
  - Custom messages

### Command protocol

Commands are written directly to Supabase via the anon client (no API route hop):

```ts
await supabase.from("pairing_sessions").update({
  last_command: command,
  last_command_at: new Date().toISOString(),
}).eq("id", sessionId);
```

#### Extended command set
| Command | Action |
|---------|--------|
| `next` | Next channel |
| `prev` | Previous channel |
| `channel_1` … `channel_9` | Jump to channel by number |
| `navigate_{slug}` | Jump to channel by slug (search results, browser) |
| `video_next` | Next video in playlist |
| `video_prev` | Previous video in playlist |
| `play_pause` | Toggle play/pause |
| `volume_up` | Increase volume |
| `volume_down` | Decrease volume |
| `mute_toggle` | Toggle mute |

### Remote state subscription (`useRemoteState.ts`)

Phone uses a Realtime subscription to the pairing session to display live TV state:

```ts
supabase
  .channel(`remote-state:${sessionId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'pairing_sessions',
    filter: `id=eq.${sessionId}`,
  }, (payload) => {
    // Handle: current_video_id, playback_state, playback_position updates
  })
  .subscribe();
```

Displays:
- Current video title, thumbnail, duration, and remaining time
- Current channel name and icon
- Playback state badge (LIVE/PAUSED)
- Live progress bar that auto-advances when `playback_state === 'playing'`

### Supporting features

- **Favorites** (`useFavorites.ts`, `/api/favorites`): save channels to localStorage + server
- **Recent channels** (`/api/history/recent`): track viewing history
- **Reactions** (`useReactions.ts`, `/api/pair/reactions`): send emoji to TV, displayed via `ReactionOverlay` overlay
- **Chat** (`useChatMessages.ts`, `/api/chat`): send text messages to TV, displayed via `ChatOverlay`
- **Swipe gestures** (`useSwipeGestures.ts`): up/down swipes on D-pad trigger channel change; left/right trigger video skip
- **Share button** (`ShareButton.tsx`): copy current video URL to clipboard

## Session Lifecycle

1. **Creation**: TV POSTs `/api/pair` on mount (never repeated — component never remounts on channel switch)
2. **Pairing**: Phone POSTs `/api/pair/join` with code → session row updated: `paired=true`, `mobile_session_id` set
3. **Active**: Commands flow via Supabase Realtime UPDATE events; TV applies channel changes
4. **Expiry**: Sessions have an `expires_at` column; `/api/pair/join` rejects expired sessions. TV generates a new code on browser reload.
5. **Unpair**: Phone-side only — clears local state, returns to code entry. No server-side session deletion.

## Supabase Setup Requirements

- Table: `pairing_sessions` — columns: `id` (uuid), `code` (text), `desktop_session_id` (uuid), `mobile_session_id` (uuid), `paired` (bool), `last_command` (text), `last_command_at` (timestamptz), `expires_at` (timestamptz)
- Realtime must be enabled with `REPLICA IDENTITY FULL` (so `payload.new` contains all columns)
- RLS: open SELECT/INSERT/UPDATE policies (session UUID is the security boundary)
- Two clients: anon client for phone writes + Realtime; service role client for session creation in API routes

## E2E Tests (`src/lib/pairing.e2e.test.ts`)

Five tests covering the full lifecycle against a live Supabase instance:

1. Creates a pairing session
2. Phone joins session by code and marks paired
3. Command flows from phone to TV via Realtime (single command)
4. Multiple commands in sequence
5. Expired session rejects join

Tests load `.env.local` directly (no dotenv dependency) and clean up created rows in `afterEach`.

Run: `npx vitest run src/lib/pairing.e2e.test.ts`

## Design System

### Glass Morphism
All remote UI surfaces use a consistent glass-morphism aesthetic:
- **Background**: 3–6% white opacity with `backdrop-filter: blur(20px)`
- **Borders**: 6–10% white opacity, 1px solid
- **Accent**: Lime green (`#cbff72`) for active states, hover states, and primary CTAs
- **Text**: White on dark background; neutral-400/500 for secondary text
- **Spacing**: 6px–8px padding, 8–16px gaps between elements
- **Shadows**: Subtle glow effects using accent color at 4–8% opacity

### Typography
- **Logo/Headlines**: Space Grotesk (500–700 weight), tracking-wider
- **Body**: Manrope (400–600 weight)
- **Monospace**: Built-in system font for debug info and timers
- **Icons**: Material Symbols Outlined (wght 100–700)

### Interaction feedback
- **Active/pressed**: `active:scale-95` (shrink 5%)
- **Disabled**: `opacity-30`
- **Loading**: Spinning border loader (2px, white 30% → white 100%)
- **Toast**: 1.5s auto-fade; color-coded by message type

### Responsive layout
- **Max width**: 28rem (max-w-lg) for phone content area
- **Safe area**: `env(safe-area-inset-bottom)` for notched devices
- **Touch targets**: min 44×44px for buttons
- **Bottom nav**: Fixed, gradient overlay, backdropped

## API Endpoints

### `POST /api/pair`
Creates a pairing session. Called by `TVClient` on mount. Returns `{ code, sessionId }`.

### `POST /api/pair/join`
Looks up session by 4-digit code, validates not expired, marks `paired=true`. Returns `{ sessionId }` or `{ error }`.

### `GET /api/pair/state?sessionId=X`
Returns current TV state for the phone remote: video title, channel info, playback position, duration.

### `GET /api/tunnel-url`
Returns the current ngrok tunnel URL read from `.ngrok-url` file (dev only).

### `GET /api/network-ip`
Returns the local machine's network IP. Fallback for QR codes when ngrok is not running.

### `GET /api/search?q=`
Full-text search across videos. Used by the phone remote's search feature.

### `GET /api/channels/guide`
Returns full channel tree (all channels with parent/children). Used by `ChannelGuide`.

### `GET /api/favorites`
Fetch user's saved channels.

### `POST /api/favorites`
Add a channel to favorites.

### `DELETE /api/favorites/:channelId`
Remove a channel from favorites.

### `GET /api/history/recent`
Returns recently viewed channels.
