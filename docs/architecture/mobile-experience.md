# Mobile Experience

## Overview

Mobile users get a distinct browsing-first experience — they can watch videos directly on their phone with native controls and on-demand playback. This is separate from the TV broadcast model and the phone remote (`/pair`). Server-side UA detection at the entry points automatically routes mobile browsers to the `/mobile` route tree before any desktop UI is rendered.

## Key Files

- `src/lib/mobile-detect.ts` — UA detection helper used by server components; tablets route to TV interface
- `src/app/mobile/page.tsx` — Mobile channel browser (browse-first landing)
- `src/app/mobile/channel/[slug]/page.tsx` — Channel playlist view on mobile
- `src/app/mobile/watch/[slug]/[videoId]/page.tsx` — Mobile video watch page (server)
- `src/app/mobile/watch/[slug]/[videoId]/MobileWatchClient.tsx` — Mobile video player (client)
- `src/components/YouTubePlayer.tsx` — Shared YouTube player; `controls` and `muted` props control behavior

## Tablet Routing Logic

Tablets (`iPad` or Android devices without `Mobile` UA token) route to the TV interface, not `/mobile`. Modern iPadOS reports as `MacIntel` by default, so legacy iPads with the `iPad` token are still routed to TV mode. This gives tablet users the full broadcast experience with the full-sized HUD.

## Data Flow

### Detection and Redirect

Every content server component calls `isMobileRequest()` before doing any heavy data fetching:

```
Request arrives at /, /watch/[slug], /watch/[slug]/[videoId], /channel/[slug]
    │
    ▼
isMobileRequest() reads User-Agent header (server-side, no JS needed)
    │
    ├── Tablet UA (iPad or Android without Mobile) → TV mode (no redirect)
    │
    ├── Phone UA → redirect to /mobile equivalent
    │       /  →  /mobile
    │       /watch/[slug]  →  /mobile/channel/[slug]
    │       /watch/[slug]/[videoId]  →  /mobile/watch/[slug]/[videoId]
    │       /channel/[slug]  →  /mobile/channel/[slug]
    │
    └── Desktop UA → proceed with normal TV flow
```

### Mobile Watch Flow

```
/mobile  →  browse channels list
    │
    ▼
/mobile/channel/[slug]  →  ordered playlist with thumbnails
    │
    ▼
/mobile/watch/[slug]/[videoId]  →  server fetches channel + video + full playlist
    │
    ▼
MobileWatchClient  →  YouTubePlayer (controls=true, muted=false)
                       prev/next video navigation
                       playlist scroll below player
```

## Important Patterns

### UA Detection

`isMobileRequest()` in `src/lib/mobile-detect.ts` reads the `User-Agent` header via Next.js `headers()`. Tablets are filtered first — `iPad` or Android without `Mobile` token return `false` (TV mode). Then it checks for: `Android`, `iPhone`, `iPod`, `webOS`, `BlackBerry`, `Opera Mini`, `IEMobile`.

The function is async (required because `headers()` is async in Next.js 15+) and is called at the top of each affected server component before any database queries, so mobile users never pay the cost of fetching TV data they won't use.

### YouTubePlayer Props for Mobile

The shared `YouTubePlayer` component accepts two props that differ between TV and mobile:

| Prop | TV mode | Mobile mode |
|------|---------|-------------|
| `controls` | `false` (default) | `true` |
| `muted` | `true` (default) | `false` |

When `controls={true}`, the transparent click-blocker overlay is removed, fullscreen and keyboard shortcuts are enabled, and the YouTube controls bar is shown. When `muted={false}`, the player starts unmuted (appropriate for deliberate mobile viewing vs. ambient TV autoplay).

### On-Demand vs. Broadcast

Mobile `/mobile/watch` is on-demand: the user picks a video, it starts from the beginning with controls. There is no schedule offset, no `whatsOnNow()` call, no looping. When a video ends (`onEnded`), `MobileWatchClient` navigates to the next video in the playlist via `window.location.href`.

### Pair Link from /pair

The `/pair` page (phone remote UI) includes a "Watch" link in the header that navigates to `/mobile`. This lets users who land on `/pair` without a TV to switch to the standalone mobile viewer without needing to go back.

## Route Map

```
/mobile                               — channel browser
/mobile/channel/[slug]                — playlist for one channel
/mobile/watch/[slug]/[videoId]        — video player + playlist
/pair                                 — phone remote (separate flow; links to /mobile)
```

Mobile routes do not perform oEmbed availability filtering (unlike the TV path). They show all videos in the database as returned by Supabase.
