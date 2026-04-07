-- Add last_command columns for discrete command passing via Realtime
ALTER TABLE pairing_sessions
  ADD COLUMN IF NOT EXISTS last_command TEXT,
  ADD COLUMN IF NOT EXISTS last_command_at TIMESTAMPTZ;

-- Enable Realtime on pairing_sessions
-- Supabase Realtime requires the table in the supabase_realtime publication
-- and REPLICA IDENTITY FULL so UPDATE payloads include all columns
ALTER TABLE pairing_sessions REPLICA IDENTITY FULL;

-- Add to the realtime publication (Supabase projects have this by default)
-- If the publication doesn't exist yet, create it first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE pairing_sessions;

-- Enable RLS (required for Realtime with anon key)
ALTER TABLE pairing_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read pairing sessions (they need the session ID)
CREATE POLICY "Anyone can read pairing sessions"
  ON pairing_sessions FOR SELECT
  USING (true);

-- Policy: anyone can update pairing sessions (mobile remote needs this)
CREATE POLICY "Anyone can update pairing sessions"
  ON pairing_sessions FOR UPDATE
  USING (true);

-- Policy: anyone can insert pairing sessions (desktop creates them)
CREATE POLICY "Anyone can insert pairing sessions"
  ON pairing_sessions FOR INSERT
  WITH CHECK (true);
