# Bug Fix 005: YouTube Player Mobile Playback Failure

**Date:** 2026-04-09
**Severity:** High — mobile users could not watch any video
**Status:** Fixed

---

## Symptom

On mobile browsers, the YouTube player displayed the error:

> "An error occurred. Please try again later."

Videos would not play at all on `/mobile/watch/[slug]/[videoId]`. The desktop TV experience was unaffected.

---

## Root Cause

`YouTubePlayer.tsx` was designed exclusively for TV-mode broadcast playback and had two hard-coded behaviors that broke mobile:

### 1. Forced mute + autoplay without controls

```ts
// Before — hardcoded TV-mode playerVars
playerVars: {
  autoplay: 1,
  mute: 1,        // always muted
  controls: 0,    // no controls
  disablekb: 1,
  fs: 0,
}
```

Mobile browsers enforce a strict autoplay policy: unmuted autoplay is blocked unless the user has previously interacted with the page. When `mute: 1` is paired with `controls: 0`, users have no way to unmute or start playback themselves if the browser blocks it. YouTube's IFrame API responds with a generic error in this state rather than a permission denial.

### 2. Invisible click-blocking overlay (always rendered)

```tsx
// Before — overlay always present, blocking all touch interaction
return (
  <div className="relative w-full h-full bg-black">
    <div ref={wrapperRef} className="w-full h-full" />
    <div className="absolute inset-0 z-10" />  {/* blocks all taps */}
  </div>
);
```

The overlay exists on the TV to suppress YouTube's default click-to-pause behavior. On mobile it intercepted every touch event, making the player completely non-interactive even if it had managed to load.

---

## The Fix

### `src/components/YouTubePlayer.tsx`

Added `controls` and `muted` props with TV-safe defaults, threaded them into `playerVars`, and made the click-blocking overlay conditional:

```ts
// After — props with TV defaults
interface YouTubePlayerProps {
  controls?: boolean;  // default: false (TV mode)
  muted?: boolean;     // default: true  (TV autoplay)
}

// playerVars now driven by props
playerVars: {
  autoplay: 1,
  mute: initialMuted.current ? 1 : 0,
  controls: initialControls.current ? 1 : 0,
  disablekb: initialControls.current ? 0 : 1,
  fs: initialControls.current ? 1 : 0,
}
```

```tsx
// Overlay only rendered when controls are off (TV mode)
{!initialControls.current && <div className="absolute inset-0 z-10" />}
```

### `src/app/mobile/watch/[slug]/[videoId]/MobileWatchClient.tsx`

Mobile client now passes `controls` and `muted={false}`, and wraps the player in `aspect-video` for correct sizing:

```tsx
// Before
<YouTubePlayer
  videoId={video.youtube_id}
  onReady={handleReady}
  onEnded={...}
/>

// After
<div className="aspect-video w-full">
  <YouTubePlayer
    videoId={video.youtube_id}
    controls          // shows native YouTube controls
    muted={false}     // audio enabled; user gesture starts playback
    onReady={handleReady}
    onEnded={...}
  />
</div>
```

---

## Key Rule

**Never reuse a TV/kiosk player component on a mobile page without opting out of TV-mode defaults.** Hardcoded `mute: 1` + `controls: 0` is a valid broadcast pattern but will silently break on mobile where the browser autoplay policy requires either user gesture or muted playback with visible controls. Always expose these as props so each call site can declare its own intent.

---

## Files Involved

- `src/components/YouTubePlayer.tsx`
- `src/app/mobile/watch/[slug]/[videoId]/MobileWatchClient.tsx`
