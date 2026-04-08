import { describe, it, expect } from "vitest";
import {
  getInitialAutoplayState,
  autoplayTransition,
  AutoplayResult,
  AutoplayEvent,
} from "./autoplay";

function send(state: AutoplayResult, ...events: AutoplayEvent["type"][]): AutoplayResult {
  return events.reduce(
    (s, type) => autoplayTransition(s, { type }),
    state
  );
}

describe("autoplay state machine", () => {
  // ── Initial state ──────────────────────────────────────────────────

  it("starts in loading state, muted, no indicator", () => {
    const initial = getInitialAutoplayState();
    expect(initial.state).toBe("loading");
    expect(initial.shouldMute).toBe(true);
    expect(initial.showMutedIndicator).toBe(false);
    expect(initial.shouldAttemptUnmute).toBe(false);
  });

  // ── Happy path: browser allows unmute ──────────────────────────────

  it("transitions to unmuted when browser allows unmute", () => {
    const result = send(
      getInitialAutoplayState(),
      "PLAYER_READY",
      "UNMUTE_ATTEMPT_SUCCEEDED"
    );
    expect(result.state).toBe("unmuted");
    expect(result.shouldMute).toBe(false);
    expect(result.showMutedIndicator).toBe(false);
  });

  // ── Muted fallback path ────────────────────────────────────────────

  it("stays muted and shows indicator when unmute is blocked", () => {
    const result = send(
      getInitialAutoplayState(),
      "PLAYER_READY",
      "UNMUTE_ATTEMPT_FAILED"
    );
    expect(result.state).toBe("muted");
    expect(result.shouldMute).toBe(true);
    expect(result.showMutedIndicator).toBe(true);
  });

  it("unmutes on user interaction after being muted", () => {
    const result = send(
      getInitialAutoplayState(),
      "PLAYER_READY",
      "UNMUTE_ATTEMPT_FAILED",
      "USER_INTERACTION"
    );
    expect(result.state).toBe("unmuted");
    expect(result.shouldMute).toBe(false);
    expect(result.showMutedIndicator).toBe(false);
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  it("user interaction while already unmuted is a no-op", () => {
    const unmuted = send(
      getInitialAutoplayState(),
      "PLAYER_READY",
      "UNMUTE_ATTEMPT_SUCCEEDED"
    );
    const result = autoplayTransition(unmuted, { type: "USER_INTERACTION" });
    expect(result.state).toBe("unmuted");
    expect(result).toBe(unmuted); // same reference — no change
  });

  it("PLAYER_READY triggers shouldAttemptUnmute", () => {
    const result = send(getInitialAutoplayState(), "PLAYER_READY");
    expect(result.shouldAttemptUnmute).toBe(true);
  });

  it("shouldAttemptUnmute is false after unmute attempt resolves", () => {
    const succeeded = send(
      getInitialAutoplayState(),
      "PLAYER_READY",
      "UNMUTE_ATTEMPT_SUCCEEDED"
    );
    expect(succeeded.shouldAttemptUnmute).toBe(false);

    const failed = send(
      getInitialAutoplayState(),
      "PLAYER_READY",
      "UNMUTE_ATTEMPT_FAILED"
    );
    expect(failed.shouldAttemptUnmute).toBe(false);
  });

  // ── Critical invariant: never shows "Click to start" ───────────────

  it("never blocks playback — video always plays (muted or unmuted)", () => {
    // The old behavior showed a "Click to start" overlay that blocked playback.
    // With the new approach, playback always starts muted. There is NO state
    // where playback is blocked waiting for user interaction.

    const afterReady = send(getInitialAutoplayState(), "PLAYER_READY");
    // After ready, we're muted but PLAYING — shouldMute is true means
    // the player is muted, not paused
    expect(afterReady.shouldMute).toBe(true);
    expect(afterReady.state).toBe("muted");

    // After unmute fails, still playing muted
    const afterFail = send(
      getInitialAutoplayState(),
      "PLAYER_READY",
      "UNMUTE_ATTEMPT_FAILED"
    );
    expect(afterFail.shouldMute).toBe(true);
    expect(afterFail.state).toBe("muted");
    // Show indicator so user knows to click for sound
    expect(afterFail.showMutedIndicator).toBe(true);
  });
});
