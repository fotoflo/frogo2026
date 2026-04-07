import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Command endpoint — still available as a fallback for sending commands
// via server-side API (e.g., from other integrations).
// The mobile remote now writes directly to the DB via the anon client,
// but this route remains for backward compatibility and server-side use.
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

  const now = new Date().toISOString();

  const updates: Record<string, any> = {
    last_command: command,
    last_command_at: now,
  };

  if (command === "play") {
    updates.playback_state = "playing";
  } else if (command === "pause") {
    updates.playback_state = "paused";
  }

  await supabase
    .from("pairing_sessions")
    .update(updates)
    .eq("id", sessionId);

  return NextResponse.json({ ok: true, command });
}
