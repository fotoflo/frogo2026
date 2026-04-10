import { NextRequest, NextResponse } from "next/server";
import { buildChannelPath } from "@/lib/channel-paths";

/**
 * POST /api/og-warm { path: "business/startups" }
 * or
 * POST /api/og-warm  (no body — warms all channels)
 *
 * Triggers OG image generation by fetching each channel's opengraph-image route,
 * which generates the image and caches it in Supabase Storage.
 */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;

  let paths: string[];

  try {
    const body = await req.json().catch(() => null);
    const { createServiceClient } = await import("@/lib/supabase");
    const supabase = createServiceClient();
    const { data: allChannels } = await supabase
      .from("channels")
      .select("id, slug, parent_id, position, name")
      .order("position", { ascending: true, nullsFirst: false })
      .order("name");

    if (body?.path) {
      paths = [body.path];
    } else if (body?.slug) {
      // Back-compat: resolve a root slug to its path
      paths = [body.slug];
    } else {
      paths = (allChannels ?? []).map((c) =>
        buildChannelPath(c, allChannels ?? []).join("/")
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fire requests in parallel — don't await the image response body,
  // just trigger the generation
  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const url = `${origin}/watch/${path}/opengraph-image`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      return { path, status: res.status };
    })
  );

  const warmed = results.map((r, i) => ({
    path: paths[i],
    ok: r.status === "fulfilled" && r.value.status === 200,
  }));

  return NextResponse.json({ warmed });
}
