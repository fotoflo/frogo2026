# Watch History

Frogo2026 tracks which videos a viewer has watched (and how far into each they got) to power two features:

1. **Watched indicators** — green checkmarks on thumbnail tiles in the playlist strip.
2. **Resume-from-last** — returning to a channel resumes the last video at the saved position (see [Playback Model](playback-model.md)).

## Data Model

Table: `watch_history`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `viewer_id` | uuid FK | Anonymous viewer identity (cookie-based, see `src/lib/viewer.ts`) |
| `video_id` | uuid FK | References `videos.id` |
| `channel_id` | uuid FK | References `channels.id` (denormalised for fast channel-level queries) |
| `seen_count` | int | Incremented on `event: "seen"` (video played to end) |
| `skip_count` | int | Incremented on `event: "skip"` (user navigated away mid-video) |
| `position_seconds` | int | Last saved playback position |
| `last_seen_at` | timestamptz | Updated on every write |

A video is considered "watched" (checkmark shown) when `seen_count > 0`.

## API Endpoints

### `GET /api/history?channelId=<id>`

Returns all videos in the channel that have been seen at least once.

Response:
```json
{
  "seen": {
    "<video-uuid>": { "seenCount": 2, "position": 142 },
    ...
  }
}
```

The `seen` map key is the `video_id`; only rows with `seen_count > 0` are returned.

Authentication is cookie-based — `getOrCreateViewer()` reads or creates an anonymous viewer record tied to a `viewer_id` cookie.

### `POST /api/history`

Records a playback event.

Request body:
```json
{
  "videoId": "<uuid>",
  "channelId": "<uuid>",
  "positionSeconds": 142,
  "event": "seen" | "skip"   // optional
}
```

- If a row already exists for `(viewer_id, video_id)`, it is updated (upsert by update).
- `event: "seen"` increments `seen_count`; `event: "skip"` increments `skip_count`.
- Omitting `event` updates only `position_seconds` and `last_seen_at` (used for in-progress position saves).

## Client Hooks

### `useWatchHistory(channelId)` — `src/lib/useWatchHistory.ts`

Fetches `GET /api/history?channelId=X` on mount (or whenever `channelId` changes). Returns:

- `seenIds: Set<string>` — O(1) lookup of seen video IDs.
- `markSeen(videoId)` — optimistically adds an ID to `seenIds` without re-fetching. Called from `TVClient` when a video ends.

### `useWatchProgress` — `src/lib/useWatchProgress.ts`

Drives the periodic writes:

- **5 s tick** — `writeLocal` + `writeUrl`. Only fires when `player.getPlayerState() === 1` (PLAYING), preventing the saved position from being overwritten on mount before the video starts.
- **5 min tick** — `POST /api/history` with current position (no event).
- **`commitSeen()`** — called on `onEnded`; POSTs `event: "seen"`.
- **`commitSkip()`** — called on prev/next navigation; POSTs `event: "skip"`.

## Key Files

- `src/app/api/history/route.ts` — GET + POST handlers
- `src/lib/useWatchHistory.ts` — fetch hook with optimistic `markSeen`
- `src/lib/useWatchProgress.ts` — position persistence (URL, localStorage, DB)
- `src/lib/viewer.ts` — anonymous viewer identity (`getOrCreateViewer`)
- `src/components/ClassicHUD/PlaylistStrip.tsx` — renders green checkmarks from `seenVideoIds` prop
