import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pairing_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Read and clear any pending command
  const command = data.playback_state === "playing" || data.playback_state === "paused"
    ? null
    : null;

  // Check for command in a simple way — we use a "command" column approach
  // For now, return session state
  return NextResponse.json({
    paired: data.paired,
    playbackState: data.playback_state,
    command: null, // Commands come through the command endpoint
  });
}
