export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  /** Admin-curated ordering. Drives the 1–9 keyboard shortcut on the TV. */
  position: number | null;
  owner_id: string | null;
  created_at: string;
}

export interface Video {
  id: string;
  channel_id: string;
  youtube_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  duration_seconds: number;
  /** Optional trim start — when set, playback seeks here instead of 0. */
  start_seconds: number | null;
  /** Optional trim end — when set, playback stops here instead of the native end. */
  end_seconds: number | null;
  position: number;
  /** YouTube COPPA: true = Made For Kids. Always verified via Data API at ingestion. */
  made_for_kids: boolean;
  /** When madeForKids was last verified via the YouTube Data API. */
  mfk_checked_at: string | null;
  created_at: string;
}

export interface PairingSession {
  id: string;
  code: string; // 4-digit pairing code
  desktop_session_id: string;
  mobile_session_id: string | null;
  current_video_id: string | null;
  playback_state: "playing" | "paused" | "idle";
  playback_position: number;
  paired: boolean;
  expires_at: string;
  created_at: string;
}
