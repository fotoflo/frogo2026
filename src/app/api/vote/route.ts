import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateViewer } from "@/lib/viewer";

export async function POST(req: NextRequest) {
  try {
    const viewer = await getOrCreateViewer();
    const { videoId, upvote } = await req.json();

    if (!videoId || typeof upvote !== "boolean") {
      return NextResponse.json({ error: "Missing videoId or upvote (boolean)" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check existing vote
    const { data: existing } = await supabase
      .from("video_votes")
      .select("id, upvote")
      .eq("viewer_id", viewer.id)
      .eq("video_id", videoId)
      .single();

    if (existing) {
      if (existing.upvote === upvote) {
        // Same vote again — no-op
        return NextResponse.json({ ok: true, changed: false });
      }

      // Change vote direction
      await supabase
        .from("video_votes")
        .update({ upvote, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      // Update aggregate: +1 new direction, -1 old direction
      if (upvote) {
        await supabase.rpc("increment_video_count", { row_id: videoId, col: "upvote_count", amount: 1 });
        await supabase.rpc("increment_video_count", { row_id: videoId, col: "downvote_count", amount: -1 });
      } else {
        await supabase.rpc("increment_video_count", { row_id: videoId, col: "downvote_count", amount: 1 });
        await supabase.rpc("increment_video_count", { row_id: videoId, col: "upvote_count", amount: -1 });
      }
    } else {
      // New vote
      await supabase.from("video_votes").insert({
        viewer_id: viewer.id,
        video_id: videoId,
        upvote,
      });

      const col = upvote ? "upvote_count" : "downvote_count";
      await supabase.rpc("increment_video_count", { row_id: videoId, col, amount: 1 });
    }

    return NextResponse.json({ ok: true, changed: true });
  } catch {
    return NextResponse.json({ error: "Failed to record vote" }, { status: 500 });
  }
}
