# Analytics

## Overview

Dual-provider analytics using the `analytics` npm package as an abstraction layer. Events flow through both **Mixpanel** (with autocapture and session recording) and **Google Analytics 4**.

## Key Files

| File | Role |
|------|------|
| `src/lib/analytics.ts` | Configures the `analytics` instance with Mixpanel + GA4 plugins |
| `src/components/AnalyticsProvider.tsx` | Client component that fires `analytics.page()` on route changes |

## Data Flow

1. `AnalyticsProvider` wraps the app in the root layout (client-side only via `"use client"`).
2. On every `pathname` change (via `usePathname`), it calls `analytics.page()`.
3. The `analytics` library fans the event out to both configured plugins.
4. Mixpanel autocapture additionally records clicks, form submissions, and other DOM interactions automatically.
5. Mixpanel session recording is enabled at 100% of sessions.

## Important Patterns

- **Client-only** — both `analytics.ts` and `AnalyticsProvider.tsx` are marked `"use client"`. No server-side tracking.
- **Abstraction layer** — the `analytics` npm package decouples event calls from providers. Adding/removing a provider is a one-line plugin change.
- **Autocapture** — Mixpanel's `autocapture: true` option captures element interactions without manual `track()` calls.
- **Session recording** — `record_sessions_percent: 100` records every visitor session in Mixpanel.
- **No custom events yet** — only automatic page views and autocaptured interactions; no manual `analytics.track()` calls in the codebase.
