-- Chat messages for pairing sessions
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES pairing_sessions(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES viewers(id) ON DELETE SET NULL,
  nickname TEXT,
  message TEXT NOT NULL CHECK (char_length(message) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, created_at);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_all" ON chat_messages FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
