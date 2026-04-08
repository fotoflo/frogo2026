# Bug Fix 003: Remote Disconnects After Channel Switch

- **Date:** 2026-04-08
- **Severity:** High

## Symptom

The phone remote worked correctly for the first channel switch command, but after switching channels it stopped responding entirely. Subsequent button presses on the phone had no effect on the TV.

## Root Cause

Channel switching was implemented using `router.push()` to navigate to a new route (`/watch/[slug]`). This caused a full React component unmount/remount of `TVClient`. On unmount, the Supabase Realtime subscription was torn down. On remount, a new pairing session was created with a new 4-digit code and session UUID — but the phone remote was still subscribed to the old session, so it could no longer communicate with the TV.

## The Fix

Refactored channel switching to stay within the same mounted `TVClient` component:

- Added a `channelIdx` state variable to track the current channel client-side.
- Channel switch commands call `setChannelIdx()` instead of `router.push()`.
- Used `history.replaceState()` to update the URL bar to reflect the active channel without triggering a navigation.
- The Supabase Realtime subscription persists across channel switches because the component never unmounts.

## Key Rule

Never use `router.push()` for state changes that must survive across views when you have persistent subscriptions or sessions. Prefer client-side state + `history.replaceState()` to update the URL without unmounting the component tree.

## Files Involved

- `src/app/watch/[slug]/TVClient.tsx` — refactored channel switching from `router.push()` to `setChannelIdx()` + `history.replaceState()`
