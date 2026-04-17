import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateViewer } from "@/lib/viewer";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  const supabase = createServiceClient();

  // Find active session by code
  const { data: session, error } = await supabase
    .from("pairing_sessions")
    .select("*")
    .eq("code", code)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 404 });
  }

  const mobileSessionId = crypto.randomUUID();

  // Mark as paired
  await supabase
    .from("pairing_sessions")
    .update({ paired: true, mobile_session_id: mobileSessionId })
    .eq("id", session.id);

  // Get or create viewer for the phone (sets cookie)
  const viewer = await getOrCreateViewer();

  return NextResponse.json({
    sessionId: session.id,
    desktopSessionId: session.desktop_session_id,
    mobileSessionId,
    viewerId: viewer.id,
    currentVideoId: session.current_video_id,
    paired: true,
  });
}
