# FrogoTV Playback Model

**FrogoTV is DVR for YouTube.**

Channels loop curated YouTube playlists on a broadcast schedule. Every channel has a canonical live timeline that's the same for everyone. The DVR model is battle-tested — we follow it as closely as possible rather than reinventing the wheel. When in doubt, ask "what would TiVo do?"

## Core Rules

### The broadcast is always live

Every channel has a live edge — the point in the playlist that corresponds to right now on the wall clock. When a viewer tunes into a channel, they always land on the live edge.

### Pause is a personal DVR

Viewers can pause. The broadcast keeps going without them. While paused, the viewer falls behind the live edge. When they unpause, playback resumes from where they left off — they're now on tape delay.

When the current video ends, the viewer snaps back to whatever is live on the channel. Pause never carries over to the next video. This keeps everyone roughly in sync and prevents viewers from drifting into a completely different version of the channel.

### Scrubbing is rewind-only

There is a scrub bar. Viewers can scrub backward within the current video to replay a moment or catch something they missed. But the scrub bar cannot advance past the live edge — you can't watch something that hasn't aired yet. This mirrors how DVR works: you can rewind the tape, but you can't fast-forward past real time.

### Channel changes always go to live

Switching channels drops any DVR state. The new channel starts at its live edge. This is true whether the viewer changes the channel themselves or another paired remote does it.

## Remote Controls

The phone remote has exactly these actions:

1. **Channel up / down** — tune to the next or previous channel (lands on live)
2. **Pause / resume** — personal DVR pause
3. **Scrub bar** — rewind within the current video, capped at the live edge
4. **Navigate to specific channels** — channel number commands

No fast-forward past live. No playlist browser on the remote. No video picker.
