import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateViewer } from "@/lib/viewer";

/**
 * GET /api/history/recent — returns recently watched channels for the viewer
 */
export async function GET() {
  const viewer = await getOrCreateViewer();
  const sb = createServiceClient();

  // Get distinct channels from watch history, most recent first
  const { data } = await sb
    .from("watch_history")
    .select("channel_id, last_seen_at, channels(id, name, slug, icon)")
    .eq("viewer_id", viewer.id)
    .order("last_seen_at", { ascending: false })
    .limit(30);

  // Deduplicate by channel_id (keep most recent)
  const seen = new Set<string>();
  const recent = (data ?? []).filter((row) => {
    if (seen.has(row.channel_id)) return false;
    seen.add(row.channel_id);
    return true;
  }).slice(0, 10);

  return NextResponse.json({ recent });
}
