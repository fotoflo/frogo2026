import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase";
import sharp from "sharp";

// This is a Route Handler (not the Next metadata opengraph-image convention)
// because catch-all segments can't host opengraph-image.tsx. generateMetadata
// in /watch/[...slug]/page.tsx points openGraph.images at /api/og/<path>.
export const runtime = "nodejs";
export const revalidate = 300;

const SIZE = { width: 1200, height: 630 };
const BUCKET = "og-images";

/** HEAD-check a thumbnail URL; returns the URL if reachable, null otherwise */
async function checkImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const len = parseInt(res.headers.get("content-length") ?? "0", 10);
    if (len > 0 && len < 2000) return null;
    return url;
  } catch {
    return null;
  }
}

/** Compress to JPEG — reduces 300KB+ PNG to ~75KB */
async function compressToJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug: segments } = await params;
  const slug = segments.join("/");
  const supabase = createServiceClient();

  const { data: allChannels } = await supabase
    .from("channels")
    .select("*");

  const { findChannelByPath } = await import("@/lib/channel-paths");
  const channel = allChannels
    ? findChannelByPath(segments, allChannels)
    : null;

  const { data: videos } = await supabase
    .from("videos")
    .select("id, youtube_id, title, thumbnail_url")
    .eq("channel_id", channel?.id ?? "")
    .order("position")
    .limit(6);

  const name = channel?.name ?? slug;
  const firstVideo = videos?.[0];

  // Cache key: slug path (with "/" → "__") + first video id
  const cacheKey = `${slug.replace(/\//g, "__")}/${firstVideo?.id ?? "empty"}.jpg`;

  // Check if we have a cached version in Supabase Storage
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(cacheKey, 60);

  if (existing?.signedUrl) {
    try {
      const cached = await fetch(existing.signedUrl, {
        signal: AbortSignal.timeout(4000),
      });
      if (cached.ok) {
        const buf = await cached.arrayBuffer();
        return new Response(buf, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      }
    } catch {
      // Cache miss or error — fall through to generate
    }
  }

  // --- Generate the OG image ---

  const rawThumbUrl = firstVideo
    ? firstVideo.thumbnail_url ||
      `https://img.youtube.com/vi/${firstVideo.youtube_id}/maxresdefault.jpg`
    : null;

  const thumbnailUrl = rawThumbUrl
    ? (await checkImage(rawThumbUrl)) ??
      (await checkImage(
        `https://img.youtube.com/vi/${firstVideo!.youtube_id}/hqdefault.jpg`
      ))
    : null;

  const logoUrl = "https://frogo.tv/images/frogo/logo.png";

  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#0a0a12",
        }}
      >
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background: thumbnailUrl
              ? "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 80%, rgba(0,0,0,0.92) 100%)"
              : "linear-gradient(135deg, #0d0d15 0%, #1a1a2e 50%, #0d0d15 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            marginTop: "-40px",
            marginLeft: "-40px",
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            fontSize: "36px",
            color: "#0a0a12",
            paddingLeft: "6px",
          }}
        >
          ▶
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            padding: "0 48px 40px 48px",
            gap: "24px",
          }}
        >
          <img
            src={logoUrl}
            alt="frogo.tv"
            style={{
              height: "120px",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: "56px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 16px rgba(0,0,0,0.6)",
            }}
          >
            {name}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            display: "flex",
            background:
              "linear-gradient(90deg, #7c5cfc 0%, #a78bfa 50%, #7c5cfc 100%)",
          }}
        />
      </div>
    ),
    { ...SIZE }
  );

  // Compress the PNG with sharp before caching
  const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const compressed = await compressToJpeg(rawBuffer);

  // Upload compressed version to Supabase Storage (fire-and-forget)
  supabase.storage
    .from(BUCKET)
    .upload(cacheKey, new Uint8Array(compressed), {
      contentType: "image/jpeg",
      upsert: true,
    })
    .then((r) => {
      if (r.error) console.error("OG cache upload failed:", r.error.message);
    });

  return new Response(new Uint8Array(compressed), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
