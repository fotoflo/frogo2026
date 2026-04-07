import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

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

  return NextResponse.json({
    sessionId: session.id,
    mobileSessionId,
    currentVideoId: session.current_video_id,
    paired: true,
  });
}
