export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
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
  position: number;
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
