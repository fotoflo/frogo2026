-- Favorites table for channel bookmarks (per viewer)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES viewers(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(viewer_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_viewer ON favorites(viewer_id);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_all" ON favorites FOR ALL USING (true);
