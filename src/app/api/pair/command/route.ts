import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Simple command queue using playback_state field
// Commands: play, pause, next, prev
export async function POST(req: NextRequest) {
  const { sessionId, command } = await req.json();
  const supabase = createServiceClient();

  // Validate session exists and is paired
  const { data: session } = await supabase
    .from("pairing_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session || !session.paired) {
    return NextResponse.json({ error: "Not paired" }, { status: 400 });
  }

  // Store command as playback_state for simplicity
  // The desktop polls and acts on it
  if (command === "play" || command === "pause") {
    await supabase
      .from("pairing_sessions")
      .update({ playback_state: command === "play" ? "playing" : "paused" })
      .eq("id", sessionId);
  }

  return NextResponse.json({ ok: true, command });
}
