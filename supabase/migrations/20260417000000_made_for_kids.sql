-- Made For Kids (MFK) compliance columns
-- YouTube ToS requires checking madeForKids via the Data API before embedding.
-- MFK videos must use privacy-enhanced mode (youtube-nocookie.com).
--
-- made_for_kids defaults to false for existing rows; the backfill script
-- (scripts/backfill-mfk.mjs) will populate accurate values from the API.
-- New videos always have this set at ingestion time — no defaulting is done
-- in application code.

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS made_for_kids BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS mfk_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN videos.made_for_kids IS
  'YouTube status.madeForKids — verified via Data API at ingestion and refresh. Default false is a placeholder for pre-backfill rows only.';

COMMENT ON COLUMN videos.mfk_checked_at IS
  'When made_for_kids was last verified via the YouTube Data API. NULL = not yet backfilled.';
