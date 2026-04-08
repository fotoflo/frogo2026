import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateViewer } from "@/lib/viewer";

export async function POST(req: NextRequest) {
  try {
    const viewer = await getOrCreateViewer();
    const { videoId, channelId, event } = await req.json();

    if (!videoId || !channelId || !event) {
      return NextResponse.json({ error: "Missing videoId, channelId, or event" }, { status: 400 });
    }

    if (event !== "seen" && event !== "skip") {
      return NextResponse.json({ error: "Event must be 'seen' or 'skip'" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const column = event === "seen" ? "seen_count" : "skip_count";

    // Upsert: insert or increment counter
    const { data: existing } = await supabase
      .from("watch_history")
      .select("id, seen_count, skip_count")
      .eq("viewer_id", viewer.id)
      .eq("video_id", videoId)
      .single();

    if (existing) {
      await supabase
        .from("watch_history")
        .update({
          [column]: existing[column] + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("watch_history").insert({
        viewer_id: viewer.id,
        video_id: videoId,
        channel_id: channelId,
        seen_count: event === "seen" ? 1 : 0,
        skip_count: event === "skip" ? 1 : 0,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to record history" }, { status: 500 });
  }
}
