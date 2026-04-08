-- Interaction tables: viewers, watch_history, video_votes, events
-- Ported from legacy frogo.tv MongoDB models (2012-2014)

-- Anonymous viewers (cookie-based identity, no auth required)
CREATE TABLE IF NOT EXISTS viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Watch history: one row per viewer+video, counters increment over time
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES viewers(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  seen_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(viewer_id, video_id)
);

-- Video votes: one row per viewer+video, boolean = upvote(true)/downvote(false)
CREATE TABLE IF NOT EXISTS video_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES viewers(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  upvote BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(viewer_id, video_id)
);

-- Aggregate vote counts on videos table
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS upvote_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvote_count INTEGER NOT NULL DEFAULT 0;

-- Generic event tracking (analytics)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  viewer_id UUID REFERENCES viewers(id) ON DELETE SET NULL,
  session_id TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_watch_history_viewer ON watch_history(viewer_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_video ON watch_history(video_id);
CREATE INDEX IF NOT EXISTS idx_video_votes_video ON video_votes(video_id);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_viewer ON events(viewer_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- RLS policies (open access like pairing_sessions — viewer token is the auth boundary)
ALTER TABLE viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Viewers: anyone can create, read own
CREATE POLICY "viewers_insert" ON viewers FOR INSERT WITH CHECK (true);
CREATE POLICY "viewers_select" ON viewers FOR SELECT USING (true);

-- Watch history: full access (viewer token scopes reads in app layer)
CREATE POLICY "watch_history_insert" ON watch_history FOR INSERT WITH CHECK (true);
CREATE POLICY "watch_history_select" ON watch_history FOR SELECT USING (true);
CREATE POLICY "watch_history_update" ON watch_history FOR UPDATE USING (true);

-- Video votes: full access
CREATE POLICY "video_votes_insert" ON video_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "video_votes_select" ON video_votes FOR SELECT USING (true);
CREATE POLICY "video_votes_update" ON video_votes FOR UPDATE USING (true);

-- Events: insert and read
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "events_select" ON events FOR SELECT USING (true);

-- RPC: atomically increment a column on the videos table
CREATE OR REPLACE FUNCTION increment_video_count(row_id UUID, col TEXT, amount INTEGER)
RETURNS void AS $$
BEGIN
  IF col = 'upvote_count' THEN
    UPDATE videos SET upvote_count = upvote_count + amount WHERE id = row_id;
  ELSIF col = 'downvote_count' THEN
    UPDATE videos SET downvote_count = downvote_count + amount WHERE id = row_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
