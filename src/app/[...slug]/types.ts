export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  description?: string;
  duration_seconds: number;
  start_seconds?: number | null;
  end_seconds?: number | null;
  thumbnail_url?: string;
  made_for_kids?: boolean;
}

export interface ChannelData {
  id: string;
  slug: string;
  parent_id: string | null;
  path: string[];
  name: string;
  icon: string;
  description: string;
  videos: Video[];
}
