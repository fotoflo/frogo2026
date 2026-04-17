# FrogoTV Playback Model

**FrogoTV is DVR for YouTube.**

Channels loop curated YouTube playlists. The current model is **resume-from-last** — when a viewer opens a channel, playback picks up where they left off rather than jumping to a live broadcast position.

## Resume Priority (Three-Tier)

When `TVClient` initialises a channel, `readInitialResume(channelId, videos)` checks three sources in order:

1. **URL `?v=slug&t=seconds`** — wins over everything. Allows bookmarking and tab-reload resumption. The `v` param is a human-readable video slug (`video-title-a1b2`) not a raw UUID; the last 4 chars of the slug are matched against the video's UUID prefix to resolve the full ID.
2. **`localStorage` `frogo:channel:<channelId>`** — per-channel last position, updated every 5 s while playing.
3. **First video, position 0** — fallback when no prior state exists.

### Slug Format

`toVideoSlug(title, id)` builds a URL-safe slug: title normalised to lowercase alphanumeric with hyphens, truncated to 40 chars, then appended with the first 4 chars of the video UUID (e.g. `building-a-compiler-a1b2`). This keeps URLs readable while remaining unique within a channel.

## Live Write Rules (`useWatchProgress`)

`src/lib/useWatchProgress.ts` drives all position persistence.

- **5 s tick** — reads `player.getCurrentTime()` and `player.getPlayerState()`. Writes to URL and localStorage **only when the player state is `1` (PLAYING)**. This guard prevents resume data being overwritten on mount before the video has actually started.
- **5 min tick** — POSTs `{ videoId, channelId, positionSeconds }` to `POST /api/history` for server-side persistence (see [Watch History](watch-history.md)).
- **`commitSeen()`** — called when a video ends naturally; POSTs `event: "seen"` + final position.
- **`commitSkip()`** — called on manual prev/next navigation; POSTs `event: "skip"` + current position.

## Channel Switching Behaviour

Switching channels resets the resume lookup to the new channel's URL/localStorage/first-video chain. The URL is updated via `window.history.replaceState` (no page navigation).

## Remote Controls

The phone remote has exactly these actions:

1. **Channel up / down** — tune to the next or previous channel (resumes from last position)
2. **Pause / resume** — personal playback pause
3. **Navigate to specific channels** — channel number or slug commands

## Prior Broadcast Model (Archived)

The original design used a deterministic half-hour broadcast schedule (`src/lib/schedule.ts` → `whatsOnNow()`). Every viewer tuned to the same channel saw the same video at the same offset, like real TV. That model was replaced by resume-from-last in favour of a more personalised viewing experience. The `schedule.ts` file is retained for possible future re-use.
