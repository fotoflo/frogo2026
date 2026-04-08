/**
 * FrogoTV broadcast schedule logic.
 *
 * Each channel's playlist loops continuously, restarting on every half-hour
 * boundary (00:00, 00:30, 01:00, 01:30 …). When a viewer tunes in, we
 * calculate which video is currently "on air" and how far into it we are.
 */

export interface ScheduledVideo {
  /** Index in the playlist */
  index: number;
  /** Seconds into this video where playback should start */
  startSeconds: number;
  /** Seconds remaining in this video before the next one */
  remainingSeconds: number;
}

/**
 * Given a playlist of videos (each with `duration_seconds`), figure out
 * what's playing right now.
 *
 * @param durations  Array of video durations in seconds, in playlist order
 * @param now        Current Date (defaults to Date.now())
 */
export function whatsOnNow(
  durations: number[],
  now: Date = new Date()
): ScheduledVideo {
  if (durations.length === 0) {
    return { index: 0, startSeconds: 0, remainingSeconds: 0 };
  }

  const totalPlaylist = durations.reduce((a, b) => a + b, 0);
  if (totalPlaylist === 0) {
    return { index: 0, startSeconds: 0, remainingSeconds: 0 };
  }

  // Seconds elapsed since the last half-hour mark
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const halfHourMinutes = minutes % 30;
  let elapsed = halfHourMinutes * 60 + seconds;

  // If the playlist is shorter than 30 minutes, it loops within the half hour
  elapsed = elapsed % totalPlaylist;

  // Walk through the playlist to find the current video
  let cumulative = 0;
  for (let i = 0; i < durations.length; i++) {
    if (cumulative + durations[i] > elapsed) {
      const startSeconds = elapsed - cumulative;
      return {
        index: i,
        startSeconds,
        remainingSeconds: durations[i] - startSeconds,
      };
    }
    cumulative += durations[i];
  }

  // Shouldn't reach here due to modulo, but fallback to first video
  return { index: 0, startSeconds: 0, remainingSeconds: durations[0] };
}
