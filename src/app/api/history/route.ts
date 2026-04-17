import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateViewer } from "@/lib/viewer";

export async function GET(req: NextRequest) {
  try {
    const viewer = await getOrCreateViewer();
    const channelId = req.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data } = await supabase
      .from("watch_history")
      .select("video_id, seen_count, position_seconds")
      .eq("viewer_id", viewer.id)
      .eq("channel_id", channelId)
      .gt("seen_count", 0);

    const seen: Record<string, { seenCount: number; position: number }> = {};
    for (const row of data ?? []) {
      seen[row.video_id] = { seenCount: row.seen_count, position: row.position_seconds };
    }
    return NextResponse.json({ seen });
  } catch {
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const viewer = await getOrCreateViewer();
    const { videoId, channelId, event, positionSeconds } = await req.json();

    if (!videoId || !channelId) {
      return NextResponse.json({ error: "Missing videoId or channelId" }, { status: 400 });
    }
    if (event && event !== "seen" && event !== "skip") {
      return NextResponse.json({ error: "Event must be 'seen' or 'skip'" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("watch_history")
      .select("id, seen_count, skip_count")
      .eq("viewer_id", viewer.id)
      .eq("video_id", videoId)
      .single();

    const now = new Date().toISOString();
    const pos = typeof positionSeconds === "number" ? Math.max(0, Math.floor(positionSeconds)) : null;

    if (existing) {
      const update: Record<string, unknown> = { last_seen_at: now };
      if (pos !== null) update.position_seconds = pos;
      if (event === "seen") update.seen_count = existing.seen_count + 1;
      if (event === "skip") update.skip_count = existing.skip_count + 1;
      await supabase.from("watch_history").update(update).eq("id", existing.id);
    } else {
      await supabase.from("watch_history").insert({
        viewer_id: viewer.id,
        video_id: videoId,
        channel_id: channelId,
        seen_count: event === "seen" ? 1 : 0,
        skip_count: event === "skip" ? 1 : 0,
        position_seconds: pos ?? 0,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to record history" }, { status: 500 });
  }
}
