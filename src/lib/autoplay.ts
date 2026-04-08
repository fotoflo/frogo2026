/**
 * Autoplay state machine for FrogoTV.
 *
 * Browsers block unmuted autoplay until user interaction. Our strategy:
 * 1. Always start muted with autoplay=1
 * 2. After player is ready, try to unmute
 * 3. If unmute fails (player pauses), stay muted and show indicator
 * 4. On first user click/tap anywhere, unmute
 *
 * This module is a pure state machine — no DOM, no timers, fully testable.
 */

export type AutoplayState = "loading" | "muted" | "unmuted";

export interface AutoplayEvent {
  type:
    | "PLAYER_READY"
    | "UNMUTE_ATTEMPT_SUCCEEDED"
    | "UNMUTE_ATTEMPT_FAILED"
    | "USER_INTERACTION";
}

export interface AutoplayResult {
  state: AutoplayState;
  /** Should the player be muted? */
  shouldMute: boolean;
  /** Should we show the muted indicator (speaker icon)? */
  showMutedIndicator: boolean;
  /** Should we attempt to unmute? (caller should try and report back) */
  shouldAttemptUnmute: boolean;
}

export function getInitialAutoplayState(): AutoplayResult {
  return {
    state: "loading",
    shouldMute: true,
    showMutedIndicator: false,
    shouldAttemptUnmute: false,
  };
}

export function autoplayTransition(
  current: AutoplayResult,
  event: AutoplayEvent
): AutoplayResult {
  switch (event.type) {
    case "PLAYER_READY":
      // Player loaded — we're muted, try to unmute
      return {
        state: "muted",
        shouldMute: true,
        showMutedIndicator: false,
        shouldAttemptUnmute: true,
      };

    case "UNMUTE_ATTEMPT_SUCCEEDED":
      return {
        state: "unmuted",
        shouldMute: false,
        showMutedIndicator: false,
        shouldAttemptUnmute: false,
      };

    case "UNMUTE_ATTEMPT_FAILED":
      // Browser blocked unmute — stay muted, show indicator
      return {
        state: "muted",
        shouldMute: true,
        showMutedIndicator: true,
        shouldAttemptUnmute: false,
      };

    case "USER_INTERACTION":
      if (current.state === "muted") {
        // User clicked — unmute
        return {
          state: "unmuted",
          shouldMute: false,
          showMutedIndicator: false,
          shouldAttemptUnmute: false,
        };
      }
      return current;

    default:
      return current;
  }
}
