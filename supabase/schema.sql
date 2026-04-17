-- Frogo2026 Database Schema
-- Run against Supabase Postgres

-- Channels (curated topic playlists)
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Videos (YouTube videos in channels)
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  made_for_kids BOOLEAN NOT NULL DEFAULT false,
  mfk_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, youtube_id)
);

-- Pairing sessions (mobile-to-desktop link)
CREATE TABLE IF NOT EXISTS pairing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  desktop_session_id TEXT NOT NULL,
  mobile_session_id TEXT,
  current_video_id UUID REFERENCES videos(id),
  playback_state TEXT NOT NULL DEFAULT 'idle' CHECK (playback_state IN ('playing', 'paused', 'idle')),
  playback_position REAL NOT NULL DEFAULT 0,
  last_command TEXT,
  last_command_at TIMESTAMPTZ,
  paired BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id, position);
CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairing_sessions(code);
CREATE INDEX IF NOT EXISTS idx_pairing_expires ON pairing_sessions(expires_at);
