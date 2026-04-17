import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/pair/state?sessionId=X
 * Returns current TV state for the phone remote: video title, channel info, position, duration.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const sb = createServiceClient();
  const { data: session } = await sb
    .from("pairing_sessions")
    .select("current_video_id, current_channel_id, playback_state, playback_position")
    .eq("id", sessionId)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  let video = null;
  if (session.current_video_id) {
    const { data } = await sb
      .from("videos")
      .select("id, youtube_id, title, thumbnail_url, duration_seconds")
      .eq("id", session.current_video_id)
      .single();
    video = data;
  }

  let channel = null;
  if (session.current_channel_id) {
    const { data } = await sb
      .from("channels")
      .select("id, name, slug, icon, parent_id")
      .eq("id", session.current_channel_id)
      .single();
    channel = data;
  }

  return NextResponse.json({
    video,
    channel,
    playbackState: session.playback_state,
    playbackPosition: session.playback_position,
  });
}
