-- Playlist editor foundation
--   1. Add trim points (start/end seconds) to videos — verbatim port of old frogotv slice model
--   2. Add owner_id to channels so authed users can edit only their own
--   3. RLS: public SELECT on channels/videos, owner-only writes
--
-- Existing data:
--   - videos.start_seconds / end_seconds default NULL (means: play full video)
--   - channels.owner_id default NULL — backfilled on first admin sign-in (see auth callback)

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS start_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS end_seconds INTEGER;

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_id);

-- Enable RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see channels + videos (this is a broadcast TV app, everything public)
DROP POLICY IF EXISTS "Public read channels" ON channels;
CREATE POLICY "Public read channels"
  ON channels FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read videos" ON videos;
CREATE POLICY "Public read videos"
  ON videos FOR SELECT
  USING (true);

-- Owner write on channels: authed users can INSERT channels they own, UPDATE/DELETE their own
DROP POLICY IF EXISTS "Owner insert channels" ON channels;
CREATE POLICY "Owner insert channels"
  ON channels FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner update channels" ON channels;
CREATE POLICY "Owner update channels"
  ON channels FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner delete channels" ON channels;
CREATE POLICY "Owner delete channels"
  ON channels FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Owner write on videos: authed users can write videos belonging to channels they own
DROP POLICY IF EXISTS "Owner insert videos" ON videos;
CREATE POLICY "Owner insert videos"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = videos.channel_id AND c.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner update videos" ON videos;
CREATE POLICY "Owner update videos"
  ON videos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = videos.channel_id AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = videos.channel_id AND c.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner delete videos" ON videos;
CREATE POLICY "Owner delete videos"
  ON videos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = videos.channel_id AND c.owner_id = auth.uid()
    )
  );
