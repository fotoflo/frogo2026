import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/og-warm { slug: "philosophy" }
 * or
 * POST /api/og-warm  (no body — warms all channels)
 *
 * Triggers OG image generation by fetching each channel's opengraph-image route,
 * which generates the image and caches it in Supabase Storage.
 */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;

  let slugs: string[];

  try {
    const body = await req.json().catch(() => null);
    if (body?.slug) {
      slugs = [body.slug];
    } else {
      // Warm all channels
      const { createServiceClient } = await import("@/lib/supabase");
      const supabase = createServiceClient();
      const { data: channels } = await supabase
        .from("channels")
        .select("slug")
        .order("name");
      slugs = (channels ?? []).map((c) => c.slug);
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fire requests in parallel — don't await the image response body,
  // just trigger the generation
  const results = await Promise.allSettled(
    slugs.map(async (slug) => {
      const url = `${origin}/watch/${slug}/opengraph-image`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      return { slug, status: res.status };
    })
  );

  const warmed = results.map((r, i) => ({
    slug: slugs[i],
    ok: r.status === "fulfilled" && r.value.status === 200,
  }));

  return NextResponse.json({ warmed });
}
