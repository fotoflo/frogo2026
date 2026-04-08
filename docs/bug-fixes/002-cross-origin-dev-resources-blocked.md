# Bug Fix 002: Cross-Origin Dev Resources Blocked via ngrok

- **Date:** 2026-04-08
- **Severity:** High

## Symptom

When accessing the phone pair page (`/pair`) via an ngrok tunnel URL, the page loaded visually but buttons and other interactive elements were completely non-functional. JavaScript did not execute. The issue only occurred over ngrok — localhost worked fine.

## Root Cause

Next.js 16 introduced an `allowedDevOrigins` security restriction that blocks cross-origin requests for dev-mode resources (HMR websocket, dev overlay scripts, etc.) when the request origin doesn't match the dev server host. Browsers blocked these resources because the ngrok origin (`*.ngrok-free.app`) was not in the allowlist, leaving the page in a broken partial-load state.

## The Fix

Added `allowedDevOrigins` to `next.config.ts` to explicitly permit ngrok domains:

```ts
allowedDevOrigins: ["*.ngrok.app", "*.ngrok-free.app"],
```

## Key Rule

In Next.js 16+, any cross-origin domain used to access the dev server (e.g. ngrok tunnels, LAN IPs) must be listed in `allowedDevOrigins` inside `next.config.ts`. Without this, the browser blocks dev-mode scripts and the page appears interactive but is broken.

## Files Involved

- `next.config.ts` — added `allowedDevOrigins` array to the config object
