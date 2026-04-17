# Frogo2026 Architecture Overview

## System Design

Frogo2026 is an always-on TV experience. Users tune into curated channels that broadcast YouTube playlists on a deterministic schedule. A phone remote (paired via QR code) controls channel switching and search. There is no browse UI, no pause button -- just TV.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Desktop     │     │  Next.js     │     │  Supabase   │
│  Browser     │◄───►│  App Router  │◄───►│  Postgres   │
│  (TV)        │     │  (Vercel)    │     │  + Realtime │
└──────┬───────┘     └──────┬───────┘     └─────────────┘
       │                    │
       │ Supabase           │ API Routes
       │ Realtime           │ /api/pair
       │ (channel cmds)     │ /api/pair/join
       │                    │ /api/search
       │                    │ /api/tunnel-url
       │                    │ /api/network-ip
┌──────┴───────┐
│  Mobile      │
│  Browser     │──── /pair  (phone remote, writes commands to Supabase)
│              │──── /mobile (standalone viewer: browse + watch on-demand)
└──────────────┘
```

## Data Model

### Channels
Curated topic playlists forming a tree via `parent_id`. Each channel has a slug (unique among siblings), name, description, icon, and optional parent. Channels with children act as directories in the TV HUD; leaf channels are the actual playlists. See [Channel Hierarchy](channel-hierarchy.md) for the full tree model and navigation logic.
- AI Programming, Philosophy, Buddhism, Kids Animals, Business

### Videos
YouTube videos belonging to channels. Ordered by `position` within a channel.
- Stores youtube_id, title, description, thumbnail, duration
- `made_for_kids` (boolean) and `mfk_checked_at` track COPPA status from YouTube's Data API
- Unavailable videos filtered server-side via YouTube oEmbed check before reaching the client
- MFK videos are played via `youtube-nocookie.com` embed host for COPPA compliance

### Pairing Sessions
Links a TV player to a phone remote.
- 4-digit code + QR code for easy pairing
- Tracks current channel and playback state
- Expires after 24 hours

## Core Flows

### Mobile Detection
Server components on `/`, `/watch/[slug]`, `/watch/[slug]/[videoId]`, and `/channel/[slug]` call `isMobileRequest()` (reads the `User-Agent` header) before any DB queries. Mobile browsers are redirected to their `/mobile` equivalents. Desktop browsers proceed to the TV flow. See [Mobile Experience](mobile-experience.md) for full details.

### TV Playback
1. `/` redirects mobile users to `/mobile`; desktop browsers redirect to the first channel (`/watch/[...slug]`)
2. Server component fetches **all channels** + their videos in parallel; filters unavailable via oEmbed
3. `TVClient` receives all channels; channel switching is client-side state (no navigation)
4. `TVClient` resolves resume position: URL `?v=slug&t=seconds` > `localStorage` > first video (no broadcast schedule)
5. `useWatchProgress` syncs position to URL + localStorage every 5 s (PLAYING-gated) and to the DB every 5 min
6. `useWatchHistory` fetches seen video IDs per channel; playlist strip shows green checkmarks on watched videos
7. YouTube player runs fullscreen, no controls, transparent overlay
8. Mouse movement reveals on-screen chrome (2.5 s inactivity fade); click expands full guide
9. QR code lingers **30 s** after chrome fades; re-appears every 3 min while unpaired; hidden when paired

### Phone Remote
1. Scan QR or enter 4-digit code at `/pair`
2. Phone writes `last_command` + `last_command_at` directly to Supabase (anon client)
3. TV receives command via Supabase Realtime UPDATE subscription; deduplicates by timestamp
4. Remote shows channel up/down, number pad (1-9), search, unpair button
5. No play/pause command — TV is always broadcasting

See also:
- [TV Mode](tv-mode.md) — resume-from-last, client-side channel switching, YouTube player, on-screen chrome
- [Playback Model](playback-model.md) — three-tier resume priority, URL slugs, PLAYING-gated writes
- [Watch History](watch-history.md) — seen-video tracking, `/api/history`, `useWatchHistory`, playlist checkmarks
- [Channel Hierarchy](channel-hierarchy.md) — tree model, scoped navigation, breadcrumbs, directory navigator
- [Pairing](pairing.md) — QR pairing flow, command protocol, Realtime subscription, e2e tests
- [Mobile Experience](mobile-experience.md) — UA detection, /mobile route tree, on-demand playback
- [MCP OAuth](mcp-oauth.md) — OAuth 2.1 AS, MCP server, full channel + video tool surface
- [YouTube Metadata](youtube-metadata.md) — Data API v3 (edit-time) vs oEmbed (render-time) split, quota notes

### OG Image Generation
Each channel has a dynamic OpenGraph image (1200x630 JPEG) generated via `next/og` and cached in Supabase Storage. See [OG Images](og-images.md) for the full caching and compression pipeline.

### Analytics
Dual-provider analytics via the `analytics` npm package. See [Analytics](analytics.md) for full details.
- **Mixpanel** — autocapture enabled, 100% session recording
- **Google Analytics** (G-RG302NZGNF) — standard page view metrics

The `AnalyticsProvider` client component wraps the app and fires `analytics.page()` on each pathname change.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Database | Supabase (Postgres + Realtime) |
| Hosting | Vercel |
| Video | YouTube IFrame API |
| Dev Tooling | ngrok (tunnel for mobile testing) |

## Key Files

- `src/app/page.tsx` -- Redirects mobile to /mobile, desktop to first channel
- `src/lib/mobile-detect.ts` -- Server-side UA detection (`isMobileRequest()`)
- `src/app/mobile/page.tsx` -- Mobile channel browser
- `src/app/mobile/channel/[slug]/page.tsx` -- Mobile channel playlist
- `src/app/mobile/watch/[slug]/[videoId]/page.tsx` -- Mobile video watch (server)
- `src/app/mobile/watch/[slug]/[videoId]/MobileWatchClient.tsx` -- Mobile video player (client)
- `src/app/watch/[...slug]/page.tsx` -- Channel watch server component (resolves multi-segment paths, video filtering, mobile redirect)
- `src/app/watch/[...slug]/TVClient.tsx` -- Fullscreen TV client (resume-from-last, remote, QR, scoped directory navigation)
- `src/app/watch/[...slug]/TVOverlays.tsx` -- Non-interactive TV overlays (QR card, mute hint, channel banner with name+icon+title, paired dot)
- `src/app/watch/[slug]/opengraph-image.tsx` -- Dynamic OG image per channel
- `src/app/api/history/route.ts` -- Watch history GET (seen video IDs) + POST (position/event recording)
- `src/app/pair/page.tsx` -- Phone remote UI
- `src/lib/schedule.ts` -- Broadcast schedule logic (retained, not currently called)
- `src/lib/useWatchProgress.ts` -- URL slug + localStorage + DB position persistence
- `src/lib/useWatchHistory.ts` -- Fetches seen video IDs per channel; optimistic markSeen
- `src/lib/useChromeVisibility.ts` -- Event-driven chrome / QR visibility state
- `src/lib/youtube-check.ts` -- YouTube oEmbed availability check (render-time)
- `src/lib/youtube-api.ts` -- YouTube Data API v3 wrapper (edit-time: add/bulk/refresh/import)
- `src/lib/channel-paths.ts` -- Channel tree helpers (path building, resolution, siblings, ancestors, descendants)
- `src/lib/supabase.ts` -- Database client
- `src/lib/types.ts` -- TypeScript interfaces
- `src/components/ClassicHUD/` -- TV heads-up display (breadcrumbs, directory navigator, scoped channel grid, player controls); split into `index.tsx` shell + `TopPanel` / `Directory` / `ChannelGrid` / `PlaylistStrip` / `BottomPanel` sub-components and a `useProgress` hook
- `src/components/YouTubePlayer.tsx` -- YouTube player; `controls` and `muted` props switch between TV and mobile modes
- `src/components/MiniQR.tsx` -- QR code overlay on TV screen
- `src/components/OnScreenRemote.tsx` -- On-screen remote overlay (mini + expanded)
- `src/app/api/pair/route.ts` -- Session creation
- `src/app/api/pair/join/route.ts` -- Phone join by code
- `src/app/api/mcp/route.ts` -- MCP Streamable HTTP endpoint (JSON-RPC 2.0, full channel CRUD + video tools)
- `src/app/api/search/route.ts` -- Video search API
- `src/app/api/tunnel-url/route.ts` -- ngrok tunnel URL endpoint
- `src/app/api/network-ip/route.ts` -- Local network IP for QR codes
- `src/lib/pairing.e2e.test.ts` -- E2E pairing lifecycle tests
- `vitest.config.ts` -- Vitest config with `@/` path alias resolution
- `scripts/dev.mjs` -- Dev server with port kill + ngrok tunnel
- `supabase/schema.sql` -- Database schema
- `supabase/seed.sql` -- Seed data
