import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/channels/guide
 * Returns all channels with their video lists for the phone EPG.
 * The phone computes whatsOnNow() client-side from durations.
 */
export async function GET() {
  const sb = createServiceClient();

  const { data: channels } = await sb
    .from("channels")
    .select("id, name, slug, icon, parent_id, position")
    .order("position", { ascending: true, nullsFirst: false })
    .order("name");

  if (!channels) return NextResponse.json({ channels: [], videos: {} });

  const channelIds = channels.map((c) => c.id);
  const { data: videos } = await sb
    .from("videos")
    .select("id, channel_id, title, duration_seconds, thumbnail_url, position")
    .in("channel_id", channelIds)
    .order("position");

  // Group videos by channel
  const videosByChannel: Record<string, typeof videos> = {};
  for (const v of videos ?? []) {
    if (!videosByChannel[v.channel_id]) videosByChannel[v.channel_id] = [];
    videosByChannel[v.channel_id]!.push(v);
  }

  return NextResponse.json({ channels, videosByChannel });
}
