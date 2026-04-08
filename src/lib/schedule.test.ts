import { describe, it, expect } from "vitest";
import { whatsOnNow } from "./schedule";

/**
 * Helper: build a Date at a specific minute:second within any half-hour.
 * Hour and day don't matter — only minutes and seconds affect the schedule.
 */
function timeAt(minutes: number, seconds: number): Date {
  const d = new Date(2026, 0, 1, 12, minutes, seconds);
  return d;
}

describe("whatsOnNow", () => {
  // ── Edge cases ──────────────────────────────────────────────────────

  it("returns zeroed result for an empty playlist", () => {
    const result = whatsOnNow([], timeAt(5, 0));
    expect(result).toEqual({ index: 0, startSeconds: 0, remainingSeconds: 0 });
  });

  it("returns zeroed result when all durations are 0", () => {
    const result = whatsOnNow([0, 0, 0], timeAt(5, 0));
    expect(result).toEqual({ index: 0, startSeconds: 0, remainingSeconds: 0 });
  });

  // ── Single video ────────────────────────────────────────────────────

  it("handles a single video shorter than 30 min (loops)", () => {
    // 10-minute video. At 25:00 into the half-hour → 25 min % 10 min = 5 min in
    const result = whatsOnNow([600], timeAt(25, 0));
    expect(result).toEqual({
      index: 0,
      startSeconds: 300,
      remainingSeconds: 300,
    });
  });

  it("handles a single video at exactly the half-hour boundary (0:00)", () => {
    const result = whatsOnNow([600], timeAt(0, 0));
    expect(result).toEqual({
      index: 0,
      startSeconds: 0,
      remainingSeconds: 600,
    });
  });

  it("handles a single video at 30:00 (second half-hour boundary)", () => {
    const result = whatsOnNow([600], timeAt(30, 0));
    expect(result).toEqual({
      index: 0,
      startSeconds: 0,
      remainingSeconds: 600,
    });
  });

  // ── Multi-video playlist ────────────────────────────────────────────

  it("returns the first video when elapsed is within its duration", () => {
    // Playlist: 120s, 180s, 300s. At 0:30 into half-hour → 30s in, first video
    const result = whatsOnNow([120, 180, 300], timeAt(0, 30));
    expect(result).toEqual({
      index: 0,
      startSeconds: 30,
      remainingSeconds: 90,
    });
  });

  it("returns the second video when elapsed passes the first", () => {
    // 120s + 60s into second = 180s elapsed → 3 min
    const result = whatsOnNow([120, 180, 300], timeAt(3, 0));
    expect(result).toEqual({
      index: 1,
      startSeconds: 60,
      remainingSeconds: 120,
    });
  });

  it("returns the third video when elapsed passes first two", () => {
    // 120 + 180 = 300s. At 6:00 (360s) → 60s into third video
    const result = whatsOnNow([120, 180, 300], timeAt(6, 0));
    expect(result).toEqual({
      index: 2,
      startSeconds: 60,
      remainingSeconds: 240,
    });
  });

  // ── Looping within a half-hour ──────────────────────────────────────

  it("loops back to the first video after the playlist ends", () => {
    // Playlist total = 120 + 180 = 300s (5 min).
    // At 7:00 (420s) → 420 % 300 = 120s → exactly at start of second video
    const result = whatsOnNow([120, 180], timeAt(7, 0));
    expect(result).toEqual({
      index: 1,
      startSeconds: 0,
      remainingSeconds: 180,
    });
  });

  it("loops multiple times within a half-hour", () => {
    // Playlist total = 60s (1 min). At 15:30 → 930s % 60 = 30s
    const result = whatsOnNow([60], timeAt(15, 30));
    expect(result).toEqual({
      index: 0,
      startSeconds: 30,
      remainingSeconds: 30,
    });
  });

  it("loops a two-video playlist correctly", () => {
    // Playlist: 30s, 30s = 60s total. At 2:15 → 135s % 60 = 15s → first video at 15s
    const result = whatsOnNow([30, 30], timeAt(2, 15));
    expect(result).toEqual({
      index: 0,
      startSeconds: 15,
      remainingSeconds: 15,
    });
  });

  // ── Seconds precision ───────────────────────────────────────────────

  it("accounts for seconds in the current time", () => {
    // At 0:45 → 45s elapsed. Playlist: [30, 60]. 45 - 30 = 15s into second video
    const result = whatsOnNow([30, 60], timeAt(0, 45));
    expect(result).toEqual({
      index: 1,
      startSeconds: 15,
      remainingSeconds: 45,
    });
  });

  it("works at exactly the boundary between two videos", () => {
    // At 2:00 → 120s. First video is exactly 120s → should start second video at 0
    const result = whatsOnNow([120, 180], timeAt(2, 0));
    expect(result).toEqual({
      index: 1,
      startSeconds: 0,
      remainingSeconds: 180,
    });
  });

  // ── Half-hour alignment ─────────────────────────────────────────────

  it("resets at the 30-minute mark", () => {
    // 31:00 → halfHourMinutes = 1, so elapsed = 60s
    const result = whatsOnNow([120, 180], timeAt(31, 0));
    expect(result).toEqual({
      index: 0,
      startSeconds: 60,
      remainingSeconds: 60,
    });
  });

  it("treats minute 59 as 29 minutes into the second half-hour", () => {
    // 59:30 → halfHourMinutes = 29, elapsed = 29*60 + 30 = 1770s
    // Playlist: [600, 600, 600] = 1800s total. 1770s → third video at 570s
    const result = whatsOnNow([600, 600, 600], timeAt(59, 30));
    expect(result).toEqual({
      index: 2,
      startSeconds: 570,
      remainingSeconds: 30,
    });
  });
});
