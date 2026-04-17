-- Add unique constraint per channel + index for fast youtube_id lookups.
-- Same YouTube video can exist in multiple channels but not twice in one.
ALTER TABLE videos ADD CONSTRAINT videos_channel_youtube_unique UNIQUE (channel_id, youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos (youtube_id);
