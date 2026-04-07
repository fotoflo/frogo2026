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
