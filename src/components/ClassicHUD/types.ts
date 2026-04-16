export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  description?: string;
  duration_seconds: number;
  thumbnail_url?: string;
}

export interface Channel {
  id: string;
  slug: string;
  parent_id?: string | null;
  /** Root-to-leaf slug segments. Used for display + href building. */
  path?: string[];
  name: string;
  icon: string;
  videos: Video[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type YTPlayer = any;

export type HUDState = "expanded" | "collapsed" | "minimized";
