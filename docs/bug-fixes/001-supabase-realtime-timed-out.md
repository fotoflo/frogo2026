# Bug Fix 001: Supabase Realtime TIMED_OUT

- **Date:** 2026-04-08
- **Severity:** Critical

## Symptom

Pairing sessions were created successfully (visible in Supabase dashboard), but the Realtime subscription on the TV client never connected. The browser console showed `TIMED_OUT` errors from the Supabase Realtime channel.

## Root Cause

The Supabase anon key in `.env.local` was in Supabase's new `sb_publishable_` format rather than the legacy JWT format (`eyJ...`). The Realtime client requires a JWT-format key to authenticate the websocket connection. The new publishable key format is not yet supported by the Realtime SDK.

## The Fix

Replaced the `sb_publishable_` format keys in `.env.local` with the JWT-format keys (`eyJ...`) from the Supabase dashboard under **Project Settings → API → Project API keys**.

## Key Rule

Always use JWT-format Supabase keys (starting with `eyJ`) for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The newer `sb_publishable_` key format does not work with Supabase Realtime websocket authentication.

## Files Involved

- `.env.local` — updated `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` values
