# Frogo2026 Architecture Overview

## System Design

Frogo2026 is an always-on TV experience. Users tune into curated channels that broadcast YouTube playlists on a deterministic schedule. A phone remote (paired via QR code) controls channel switching and search. There is no browse UI, no pause button -- just TV.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Desktop     │     │  Next.js     │     │  Supabase   │
│  Browser     │◄───►│  App Router  │◄───►│  Postgres   │
│  (TV)        │     │  (Vercel)    │     │             │
└──────┬───────┘     └──────┬───────┘     └─────────────┘
       │                    │
       │ Supabase           │ API Routes
       │ Realtime           │ /api/search
       │                    │ /api/tunnel-url
       │                    │ /api/network-ip
┌──────┴───────┐     ┌──────┴───────┐
│  Mobile      │     │  Redis       │
│  Browser     │     │  (Sessions   │
│  (Remote)    │     │   + State)   │
└──────────────┘     └──────────────┘
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
2. Server component filters out unavailable videos via oEmbed
3. `TVClient` calculates broadcast position from half-hour schedule boundaries
4. YouTube player runs fullscreen, no controls, transparent overlay
5. Mouse movement reveals on-screen chrome (450ms fade); click expands full guide
6. QR code + 4-digit code linger 10s after chrome fades

### Phone Remote
1. Scan QR or enter 4-digit code at `/pair`
2. Remote shows channel up/down, number pad (1-9), search
3. No play/pause -- TV is always playing

See also:
- [TV Mode](tv-mode.md) -- schedule system, fullscreen behavior, on-screen remote
- [Pairing](pairing.md) -- QR pairing flow, remote control interface

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Database | Supabase (Postgres) |
| Cache/State | Redis |
| Hosting | Vercel |
| Video | YouTube IFrame API |
| Dev Tooling | ngrok (tunnel for mobile testing) |

## Key Files

- `src/app/page.tsx` -- Redirects to first channel
- `src/app/watch/[slug]/page.tsx` -- Channel watch server component (video filtering)
- `src/app/watch/[slug]/TVClient.tsx` -- Fullscreen TV client (schedule, remote, QR)
- `src/app/pair/page.tsx` -- Phone remote UI
- `src/lib/schedule.ts` -- Broadcast schedule logic
- `src/lib/youtube-check.ts` -- YouTube oEmbed availability check
- `src/lib/supabase.ts` -- Database client
- `src/lib/types.ts` -- TypeScript interfaces
- `src/components/YouTubePlayer.tsx` -- YouTube player (no controls, overlay)
- `src/components/MiniQR.tsx` -- QR code overlay on TV screen
- `src/components/OnScreenRemote.tsx` -- On-screen remote overlay
- `src/app/api/search/route.ts` -- Video search API
- `src/app/api/tunnel-url/route.ts` -- ngrok tunnel URL endpoint
- `src/app/api/network-ip/route.ts` -- Local network IP for QR codes
- `scripts/dev.mjs` -- Dev server with port kill + ngrok
- `supabase/schema.sql` -- Database schema
- `supabase/seed.sql` -- Seed data
