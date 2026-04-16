-- Track playback position so viewers can resume across devices.
-- Live-state writes (every 5s) happen in localStorage + URL; this column
-- is only written on video-finish and at a 5-minute cadence.
ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS position_seconds INTEGER NOT NULL DEFAULT 0;
