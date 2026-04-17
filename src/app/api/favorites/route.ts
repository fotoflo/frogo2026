import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateViewer } from "@/lib/viewer";

/**
 * GET  /api/favorites — list viewer's favorite channels
 * POST /api/favorites { channelId } — add favorite
 * DELETE /api/favorites { channelId } — remove favorite
 */
export async function GET() {
  const viewer = await getOrCreateViewer();
  const sb = createServiceClient();

  const { data } = await sb
    .from("favorites")
    .select("channel_id, channels(id, name, slug, icon)")
    .eq("viewer_id", viewer.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ favorites: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { channelId } = await req.json();
  if (!channelId) return NextResponse.json({ error: "Missing channelId" }, { status: 400 });

  const viewer = await getOrCreateViewer();
  const sb = createServiceClient();

  const { error } = await sb
    .from("favorites")
    .upsert({ viewer_id: viewer.id, channel_id: channelId }, { onConflict: "viewer_id,channel_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { channelId } = await req.json();
  if (!channelId) return NextResponse.json({ error: "Missing channelId" }, { status: 400 });

  const viewer = await getOrCreateViewer();
  const sb = createServiceClient();

  await sb
    .from("favorites")
    .delete()
    .eq("viewer_id", viewer.id)
    .eq("channel_id", channelId);

  return NextResponse.json({ ok: true });
}
