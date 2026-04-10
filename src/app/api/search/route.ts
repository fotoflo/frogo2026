import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createServiceClient();

  const { data: videos } = await supabase
    .from("videos")
    .select("id, title, description, thumbnail_url, duration_seconds, channel_id, channels(id, slug, name, icon)")
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .order("title")
    .limit(20);

  return NextResponse.json({ results: videos ?? [] });
}
