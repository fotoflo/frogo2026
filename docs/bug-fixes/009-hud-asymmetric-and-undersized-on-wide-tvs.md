# Bug Fix 009: ClassicHUD Asymmetric and Undersized on Wide TVs

**Date:** 2026-04-16
**Severity:** Medium — visual only, no functional break. Controls worked; they just looked wrong on anything bigger than a laptop screen
**Status:** Fixed

---

## Symptom

On full-size TVs (1920px+ displays), the ClassicHUD overlay had two related problems:

1. **Asymmetric horizontal position.** The HUD hugged the left edge of the screen, with a visibly larger gap on the right than on the left. It looked like someone had nudged it off-center.
2. **Undersized controls.** All the HUD chrome — button icons, progress bar, timestamp text, channel label — rendered at the same pixel size on a 65-inch TV as it did on a 13-inch laptop. From a couch, the controls looked like a tiny desktop toolbar glued to the bottom of the screen.

On a laptop and in dev on a normal monitor, everything looked fine — both issues only showed up once the browser window got wide enough (1600px+) for the max-width clamp to kick in or for the fixed pixel sizes to feel cramped relative to the viewport.

---

## Root Cause

Two independent issues, both in `src/app/globals.css` and the ClassicHUD component.

### 1. The asymmetry

`.classic-hud` was positioned like this:

```css
/* src/app/globals.css — before */
.classic-hud {
  position: absolute;
  bottom: 2rem;
  left: 5%;
  width: 90%;
  max-width: 1400px;
  /* ... */
}
```

At a glance this looks symmetric — 5% on each side, 90% in the middle. And it is, right up until the viewport gets wider than ~1555px. At that point `max-width: 1400px` clamps the width, but `left: 5%` keeps anchoring the left edge to 5% of the viewport. The element stops growing on the right, so all the extra horizontal space piles up on the right side. Left margin stays at `5vw`; right margin grows unbounded.

On a 1920px screen:

- Left margin: `96px` (5% of 1920)
- Element width: `1400px` (clamped)
- Right margin: `1920 - 96 - 1400 = 424px`

424px of empty space on the right, 96px on the left. That's the asymmetry.

### 2. The undersized controls

Every dimension inside the HUD was a fixed pixel value, hardcoded either in `globals.css` or inline in `ClassicHUD.tsx`:

```css
/* globals.css — before */
.hud-top-panel      { height: 52px; }
.hud-bottom-panel   { height: 52px; }
.hud-ctrl-btn       { width: 30px; height: 30px; }
.hud-progress-bar-interactive { height: 4px; }
.hud-progress-handle { width: 12px; height: 12px; }
```

```tsx
// ClassicHUD.tsx — before
<span className="text-[10px]">…</span>
<span className="text-[11px]">…</span>
<svg width="14" height="14">…</svg>
```

None of this scaled. At 1920px, 2560px, or 3840px it rendered at exactly the same size as on a 1366px laptop. There wasn't a single responsive variant anywhere in the HUD.

---

## Why It Was Hard to Find

`left: 5%` + `width: 90%` looks symmetric at a glance — and it is, until the `max-width` clamp activates. The asymmetry is invisible in dev on a normal-sized window because the clamp never triggers. You only see it once someone tests on a display wide enough to exceed the `max-width`, at which point the geometry silently stops behaving the way the CSS suggests.

---

## The Fix

### 1. Center the HUD honestly

Replace the `left: 5% + width: 90%` pair with true horizontal auto-margins:

```css
/* src/app/globals.css — after */
.classic-hud {
  position: absolute;
  bottom: 2rem;
  left: 0;
  right: 0;
  margin-inline: auto;
  max-width: 1800px;
  /* ... */
}
```

With `left: 0; right: 0; margin-inline: auto`, the browser distributes any leftover horizontal space evenly on both sides no matter how wide the viewport is or whether the `max-width` clamp is active. The element is genuinely centered. Also bumped `max-width` from `1400px` to `1800px` so the HUD uses more of a wide TV's real estate before clamping.

### 2. Strip fixed dimensions, scale with responsive variants

Removed fixed heights and sizes from `.hud-top-panel`, `.hud-bottom-panel`, `.hud-ctrl-btn`, `.hud-progress-bar-interactive`, and `.hud-progress-handle` in `globals.css`, letting their children drive size through Tailwind utilities instead.

Then split the monolithic `ClassicHUD.tsx` into `src/components/ClassicHUD/` (index + 7 sub-components) and applied Tailwind responsive variants at two breakpoints — `min-[1600px]:` and `min-[2000px]:` — on every piece of HUD chrome. Pattern:

```tsx
// Before
<button className="hud-ctrl-btn">
  <svg width="14" height="14">…</svg>
</button>
<span className="text-[10px]">00:42</span>

// After
<button className="hud-ctrl-btn w-[30px] h-[30px] min-[1600px]:w-[44px] min-[1600px]:h-[44px] min-[2000px]:w-[56px] min-[2000px]:h-[56px]">
  <svg className="w-[14px] h-[14px] min-[1600px]:w-[20px] min-[1600px]:h-[20px] min-[2000px]:w-[26px] min-[2000px]:h-[26px]">…</svg>
</button>
<span className="text-[10px] min-[1600px]:text-[14px] min-[2000px]:text-[18px]">00:42</span>
```

Button targets, SVG icons, font sizes, and panel paddings all scale up at 1600px and again at 2000px. On a laptop the HUD looks identical to before; on a 1920px monitor it's notably bigger and more readable; on a 4K TV everything is couch-distance legible.

---

## Key Rule

**When pairing `left:` positioning with `max-width:`, use `margin-inline: auto` or the element won't actually center.** `left: 5%; width: 90%; max-width: 1400px` reads as symmetric but silently dumps the overflow on one side once the clamp activates. `left: 0; right: 0; margin-inline: auto` is the honest way to say "centered, up to this width" and survives every viewport size.

Corollary: **any UI chrome that will be viewed from across a room needs responsive size variants, not fixed pixels.** A HUD tuned for a laptop screen is unreadable on a TV, even though the pixel count is larger — viewing distance scales faster than resolution does. Pick a couple of breakpoints (1600px, 2000px) and scale button targets, icons, and text at each one.

---

## Files Involved

- `src/app/globals.css` — replaced `.classic-hud`'s `left: 5%; width: 90%` positioning with `left: 0; right: 0; margin-inline: auto`; bumped `max-width` to `1800px`; stripped fixed heights/sizes from `.hud-top-panel`, `.hud-bottom-panel`, `.hud-ctrl-btn`, `.hud-progress-bar-interactive`, `.hud-progress-handle`
- `src/components/ClassicHUD.tsx` — deleted; replaced by a folder
- `src/components/ClassicHUD/` — new folder with `index.tsx` plus 7 sub-components (top panel, bottom panel, progress bar, control buttons, channel label, timestamp, etc.); every sub-component uses `min-[1600px]:` and `min-[2000px]:` Tailwind variants to scale buttons, SVGs, fonts, and paddings on wide TVs
