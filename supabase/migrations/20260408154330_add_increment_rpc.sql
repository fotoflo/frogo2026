-- Fix: create RPC and policies that were missed due to partial migration apply

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

-- Idempotent policy creation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'viewers_insert' AND tablename = 'viewers') THEN
    CREATE POLICY "viewers_insert" ON viewers FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'viewers_select' AND tablename = 'viewers') THEN
    CREATE POLICY "viewers_select" ON viewers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'watch_history_insert' AND tablename = 'watch_history') THEN
    CREATE POLICY "watch_history_insert" ON watch_history FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'watch_history_select' AND tablename = 'watch_history') THEN
    CREATE POLICY "watch_history_select" ON watch_history FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'watch_history_update' AND tablename = 'watch_history') THEN
    CREATE POLICY "watch_history_update" ON watch_history FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'video_votes_insert' AND tablename = 'video_votes') THEN
    CREATE POLICY "video_votes_insert" ON video_votes FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'video_votes_select' AND tablename = 'video_votes') THEN
    CREATE POLICY "video_votes_select" ON video_votes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'video_votes_update' AND tablename = 'video_votes') THEN
    CREATE POLICY "video_votes_update" ON video_votes FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'events_insert' AND tablename = 'events') THEN
    CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'events_select' AND tablename = 'events') THEN
    CREATE POLICY "events_select" ON events FOR SELECT USING (true);
  END IF;
END $$;
