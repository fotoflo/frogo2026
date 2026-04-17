-- Add current_channel_id to pairing_sessions for TV→Phone state sync
ALTER TABLE pairing_sessions
  ADD COLUMN IF NOT EXISTS current_channel_id UUID REFERENCES channels(id);
