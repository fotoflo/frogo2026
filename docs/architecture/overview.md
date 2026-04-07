# Frogo2026 Architecture Overview

## System Design

Frogo2026 is a social video watching platform where users browse curated channels, watch YouTube videos, and sync playback between devices via a pairing system.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Desktop     │     │  Next.js     │     │  Supabase   │
│  Browser     │◄───►│  App Router  │◄───►│  Postgres   │
│  (Player)    │     │  (Vercel)    │     │             │
└──────┬───────┘     └──────┬───────┘     └─────────────┘
       │                    │
       │ WebSocket/         │ API Routes
       │ Realtime           │
       │                    │
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

### Pairing Sessions
Links a desktop player to a mobile remote control.
- 4-digit code + QR code for easy pairing
- Tracks current video, playback state, and position
- Expires after 24 hours

## Pairing Flow

1. Desktop opens player → creates pairing session → gets 4-digit code + QR
2. Mobile scans QR or enters code → joins session
3. Both devices sync via Supabase Realtime (or polling fallback)
4. Mobile acts as remote: play/pause, skip, seek, volume

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Database | Supabase (Postgres) |
| Cache/State | Redis |
| Hosting | Vercel |
| Video | YouTube IFrame API |

## Key Files

- `src/lib/supabase.ts` — Database client (browser + service role)
- `src/lib/types.ts` — TypeScript interfaces
- `supabase/schema.sql` — Database schema
- `supabase/seed.sql` — Seed data (channels + videos)
- `src/app/` — Pages and API routes
