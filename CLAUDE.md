# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frogo2026 — A social video watching platform modeled after broadcast TV. Reboot of frogo.tv (2012-2014). Channels loop curated YouTube playlists on a half-hour schedule. Mobile phones pair as channel remotes via QR code + 4-digit code. No play/pause — the TV is always broadcasting.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript (strict)
- Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline` syntax, not v3 `@tailwind` directives)
- Supabase (Postgres + Realtime) for database and live command passing
- Deployed on Vercel
- Path alias: `@/*` → `./src/*`

## Commands

- `pnpm run dev` — starts Next.js on port 5555 + ngrok tunnel for phone pairing (see `scripts/dev.mjs`)
- `pnpm run build` — production build
- `pnpm run lint` — ESLint
- `pnpm run test` — vitest (run single: `npx vitest run src/lib/schedule.test.ts`)

## Architecture

### Broadcast Model
The TV always plays. Each channel's playlist loops on 30-minute boundaries. `src/lib/schedule.ts` → `whatsOnNow()` calculates which video is "on air" and how far in, given the current wall-clock time. When a viewer tunes in mid-loop, playback seeks to the correct offset.

### Page Flow
- `/` (Home) — server component that redirects to the first channel's watch page
- `/watch/[slug]` — server component fetches channel + videos + filters unavailable YouTube videos via oEmbed, then renders `TVClient` (client component)
- `/watch/[slug]/[videoId]` — individual video watch page with `WatchClient`
- `/pair` — phone remote UI (code entry → command buttons)
- `/channel/[slug]` — channel detail / playlist view

### Pairing System (QR + 4-digit code)
1. **TV creates session** — `TVClient` POSTs to `/api/pair` on mount → gets 4-digit code + session UUID stored in `pairing_sessions` table
2. **QR display** — `MiniQR` component encodes `https://<host>/pair?code=XXXX`. Host resolved via `/api/tunnel-url` (ngrok) → `/api/network-ip` (LAN) → `window.location` fallback
3. **Phone joins** — `/pair` page POSTs code to `/api/pair/join` → marks session `paired=true`, returns `sessionId`
4. **Commands flow** — Phone writes `last_command` + `last_command_at` directly to Supabase row via anon client. TV subscribes to `postgres_changes` UPDATE events on that row, deduplicates by timestamp, and calls `handleCommand()`
5. **Commands**: `next`, `prev`, `channel_1`–`channel_9`, `navigate_{slug}`

### Supabase Setup
- Tables: `channels`, `videos`, `pairing_sessions` (see `supabase/schema.sql`)
- Realtime must be enabled on `pairing_sessions` with `REPLICA IDENTITY FULL` (see `supabase/migrations/`)
- RLS enabled: open SELECT/INSERT/UPDATE policies on `pairing_sessions` (session ID is the auth boundary)
- Two clients in `src/lib/supabase.ts`: anon client (client-side, Realtime) and service role client (server components, API routes)

### YouTube Video Filtering
`src/lib/youtube-check.ts` checks availability via YouTube oEmbed (no API key). Unavailable/private/deleted videos are filtered out server-side before reaching the player. Results cached 30 minutes in-memory.

### Native App
`native/` contains a React Native companion app (Expo) with its own pairing UI. Shares the same Supabase backend.

## Conventions

- Package manager is **pnpm** (not npm/yarn)
- Write architecture docs as you go in `docs/architecture/`
- Use Supabase client from `@/lib/supabase` — `supabase` for client-side, `createServiceClient()` for server-side
- API routes in `src/app/api/`
- **Refactor when necessary** — don't keep patching if the current structure is the problem. If a change uncovers a design issue (wrong file, wrong layer, missing abstraction), fix the structure first.
- **Never write files longer than 300 lines.** If a file is approaching 300 lines, split it before adding more. If an edit would push a file past 300, refactor first — don't append.
- **Styling lives in TSX with Tailwind utilities**, not in `globals.css`. Use responsive variants (`md:`, `2xl:`, `min-[1600px]:`) inline. Only put genuinely reusable primitives or things Tailwind can't express in `globals.css`.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key (used client-side for Realtime)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-side only)

Optional:
- `NGROK_AUTHTOKEN` — enables ngrok tunnel in dev for cross-network phone pairing

## Important Notes

- Credentials shared with aimhuge/claw-home Supabase instance
- .env.local must NOT be committed
- Dev server clears `.next` cache and kills port 5555 on startup
