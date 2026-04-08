import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateViewer } from "@/lib/viewer";

export async function POST(req: NextRequest) {
  try {
    const viewer = await getOrCreateViewer();
    const { event, sessionId, payload } = await req.json();

    if (!event) {
      return NextResponse.json({ error: "Missing event name" }, { status: 400 });
    }

    const supabase = createServiceClient();

    await supabase.from("events").insert({
      event,
      viewer_id: viewer.id,
      session_id: sessionId || null,
      payload: payload || {},
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}
