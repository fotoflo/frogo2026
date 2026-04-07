# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frogo2026 — A modern social video watching platform. Reboot of the original frogo.tv (2012-2014). Watch YouTube videos together with friends, synced playback, mobile-to-desktop pairing via QR code + 4-digit code.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript (strict)
- Tailwind CSS v4 (uses `@import "tailwindcss"` and `@theme inline` syntax, not v3 `@tailwind` directives)
- Supabase (Postgres) for database
- Redis for real-time state and sessions
- Deployed on Vercel
- Path alias: `@/*` → `./src/*`

## Commands

- `pnpm run dev` — dev server
- `pnpm run build` — production build
- `pnpm run lint` — ESLint

## Project Structure

- `src/app/` — App Router pages and API routes
- `src/lib/` — Shared utilities, database client, types
- `src/components/` — Shared React components
- `docs/architecture/` — Architecture documentation (keep updated as you build)
- `public/` — Static assets

## Key Concepts

- **Channels**: Curated topic playlists (AI Programming, Philosophy, Buddhism, Kids Animals, Business)
- **Pairing**: QR code + 4-digit code to link mobile remote to desktop player
- **Sync**: Real-time video playback sync between paired devices

## Conventions

- Package manager is **pnpm** (not npm/yarn)
- Write architecture docs as you go in `docs/architecture/`
- Use Supabase client from `@supabase/supabase-js`
- API routes in `src/app/api/`

## Important Notes

- Credentials shared with aimhuge/claw-home Supabase instance
- .env.local must NOT be committed
