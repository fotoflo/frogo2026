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
│  Browser     │
│  (Remote)    │
└──────────────┘
```

## Data Model

### Channels
Curated topic playlists. Each channel has a slug, name, description, and icon.
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

### TV Playback
1. `/` redirects to the first channel (`/watch/[slug]`)
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
- [Pairing](pairing.md) — QR pairing flow, command protocol, Realtime subscription, e2e tests

### OG Image Generation
Each channel has a dynamic OpenGraph image generated at build/request time via `next/og`. When a channel URL is shared on social media, the image shows:
1. Full-bleed thumbnail from the channel's first video (validated via HEAD request)
2. Play button overlay centered on the thumbnail
3. Frogo logo and channel name along the bottom
4. Purple accent bar at the bottom edge
5. Up to 3 additional video thumbnails (validated in parallel)

Thumbnail validation uses HEAD requests with a 3-second timeout. YouTube's `maxresdefault.jpg` is tried first, falling back to `hqdefault.jpg`. Tiny placeholder images (<2KB, which YouTube returns for missing thumbnails) are rejected. Images revalidate daily (`revalidate = 86400`).

### Analytics
Page views are tracked via the `analytics` library with two plugins:
- **Mixpanel** (token: 100718) — user behavior, custom events
- **Google Analytics** (G-RG302NZGNF) — standard page view metrics

The `AnalyticsProvider` client component wraps the app and fires `analytics.page()` on each pathname change. See `src/lib/analytics.ts`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Database | Supabase (Postgres + Realtime) |
| Hosting | Vercel |
| Video | YouTube IFrame API |
| Dev Tooling | ngrok (tunnel for mobile testing) |

## Key Files

- `src/app/page.tsx` -- Redirects to first channel
- `src/app/watch/[slug]/page.tsx` -- Channel watch server component (video filtering)
- `src/app/watch/[slug]/TVClient.tsx` -- Fullscreen TV client (schedule, remote, QR)
- `src/app/watch/[slug]/opengraph-image.tsx` -- Dynamic OG image per channel
- `src/app/pair/page.tsx` -- Phone remote UI
- `src/lib/schedule.ts` -- Broadcast schedule logic
- `src/lib/youtube-check.ts` -- YouTube oEmbed availability check
- `src/lib/supabase.ts` -- Database client
- `src/lib/types.ts` -- TypeScript interfaces
- `src/components/YouTubePlayer.tsx` -- YouTube player (no controls, overlay)
- `src/components/MiniQR.tsx` -- QR code overlay on TV screen
- `src/components/OnScreenRemote.tsx` -- On-screen remote overlay (mini + expanded)
- `src/app/api/pair/route.ts` -- Session creation
- `src/app/api/pair/join/route.ts` -- Phone join by code
- `src/app/api/search/route.ts` -- Video search API
- `src/app/api/tunnel-url/route.ts` -- ngrok tunnel URL endpoint
- `src/app/api/network-ip/route.ts` -- Local network IP for QR codes
- `src/lib/pairing.e2e.test.ts` -- E2E pairing lifecycle tests
- `scripts/dev.mjs` -- Dev server with port kill + ngrok tunnel
- `supabase/schema.sql` -- Database schema
- `supabase/seed.sql` -- Seed data
