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
- Unavailable videos filtered server-side via YouTube oEmbed check before reaching the client

### Pairing Sessions
Links a TV player to a phone remote.
- 4-digit code + QR code for easy pairing
- Tracks current channel and playback state
- Expires after 24 hours

## Core Flows

### Mobile Detection
Server components on `/`, `/watch/[slug]`, `/watch/[slug]/[videoId]`, and `/channel/[slug]` call `isMobileRequest()` (reads the `User-Agent` header) before any DB queries. Mobile browsers are redirected to their `/mobile` equivalents. Desktop browsers proceed to the TV flow. See [Mobile Experience](mobile-experience.md) for full details.

### TV Playback
1. `/` redirects mobile users to `/mobile`; desktop browsers redirect to the first channel (`/watch/[slug]`)
2. Server component fetches **all channels** + their videos in parallel; filters unavailable via oEmbed
3. `TVClient` receives all channels; channel switching is client-side state (no navigation)
4. `TVClient` calculates broadcast position from half-hour schedule boundaries
5. YouTube player runs fullscreen, no controls, transparent overlay
6. Mouse movement reveals on-screen chrome (450ms fade); click expands full guide
7. QR code + 4-digit code linger 10s after chrome fades; hidden when paired

### Phone Remote
1. Scan QR or enter 4-digit code at `/pair`
2. Phone writes `last_command` + `last_command_at` directly to Supabase (anon client)
3. TV receives command via Supabase Realtime UPDATE subscription; deduplicates by timestamp
4. Remote shows channel up/down, number pad (1-9), search, unpair button
5. No play/pause command — TV is always broadcasting

See also:
- [TV Mode](tv-mode.md) — schedule system, client-side channel switching, YouTube player, on-screen chrome
- [Channel Hierarchy](channel-hierarchy.md) — tree model, scoped navigation, breadcrumbs, directory navigator
- [Pairing](pairing.md) — QR pairing flow, command protocol, Realtime subscription, e2e tests
- [Mobile Experience](mobile-experience.md) — UA detection, /mobile route tree, on-demand playback
- [MCP OAuth](mcp-oauth.md) — OAuth 2.1 AS, MCP server, channel CRUD tools (list, get, create, update, delete)

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
- `src/app/watch/[...slug]/TVClient.tsx` -- Fullscreen TV client (schedule, remote, QR, scoped directory navigation)
- `src/app/watch/[slug]/opengraph-image.tsx` -- Dynamic OG image per channel
- `src/app/pair/page.tsx` -- Phone remote UI
- `src/lib/schedule.ts` -- Broadcast schedule logic
- `src/lib/youtube-check.ts` -- YouTube oEmbed availability check
- `src/lib/channel-paths.ts` -- Channel tree helpers (path building, resolution, siblings, ancestors, descendants)
- `src/lib/supabase.ts` -- Database client
- `src/lib/types.ts` -- TypeScript interfaces
- `src/components/ClassicHUD.tsx` -- TV heads-up display (breadcrumbs, directory navigator, scoped channel grid, player controls)
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
