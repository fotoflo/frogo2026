import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  const { videoId } = await req.json();
  const supabase = createServiceClient();

  const code = generateCode();
  const desktopSessionId = generateSessionId();

  const { data, error } = await supabase
    .from("pairing_sessions")
    .insert({
      code,
      desktop_session_id: desktopSessionId,
      current_video_id: videoId || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: data.id,
    code: data.code,
    desktopSessionId,
  });
}
