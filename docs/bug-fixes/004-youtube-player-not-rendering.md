# Bug Fix 004: YouTube Player Not Rendering After Refactor

- **Date:** 2026-04-08
- **Severity:** High

## Symptom

After the channel-switching refactor, the YouTube player showed a black screen with no video. The player iframe never appeared in the DOM. The issue was consistent and reproducible on every page load.

## Root Cause

Multiple cascading issues caused the player to be destroyed before it could render:

1. **Callback dependency churn:** The `useEffect` that initializes the YouTube IFrame API player had callbacks (e.g. `onReady`, `onStateChange`) listed as dependencies. Because these callbacks were recreated on each render (new function references), the effect cleaned up and re-ran repeatedly, destroying the player instance each cycle.

2. **React Strict Mode double-mount:** React 18+ Strict Mode intentionally mounts → unmounts → remounts components in development. The cleanup function on the first mount destroyed the partially-initialized `YT.Player` object. When it remounted, the player tried to attach to a DOM node that was already in an invalid state.

## The Fix

Three-part fix:

1. **Singleton API loading:** Wrapped the YouTube IFrame API script injection in a module-level guard so it only loads once, regardless of how many times the component mounts.

2. **Callbacks in refs:** Moved all player callbacks (`onReady`, `onStateChange`, etc.) into `useRef` objects. Refs don't change identity between renders, so they are safe to reference from effects without being listed as dependencies.

3. **Fresh DOM node per mount:** Instead of targeting a fixed `id` in the JSX, created a new `<div>` element imperatively inside the effect and appended it to a stable container ref. This node is owned by the effect and survives the Strict Mode cleanup/remount cycle cleanly.

## Key Rule

YouTube IFrame API players are imperative and stateful — treat them like third-party DOM widgets. Never list callbacks as `useEffect` dependencies; store them in refs instead. Always account for React Strict Mode's double-mount when initializing external players or media APIs.

## Files Involved

- `src/components/YouTubePlayer.tsx` (or equivalent player component) — singleton API load guard, callback refs, fresh DOM div per mount
