import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const alt = "Frogo.tv Channel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Revalidate daily — refreshes the thumbnail from the first video
export const revalidate = 86400;

/** HEAD-check a thumbnail URL; returns the URL if reachable, null otherwise */
async function checkImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    // YouTube returns a tiny placeholder (~1KB) for missing maxresdefault
    const len = parseInt(res.headers.get("content-length") ?? "0", 10);
    if (len > 0 && len < 2000) return null;
    return url;
  } catch {
    return null;
  }
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("slug", slug)
    .single();

  const { data: videos } = await supabase
    .from("videos")
    .select("youtube_id, title, thumbnail_url")
    .eq("channel_id", channel?.id ?? "")
    .order("position")
    .limit(6);

  const name = channel?.name ?? slug;
  const description = channel?.description ?? "";
  const firstVideo = videos?.[0];

  // Build thumbnail URL for the main video
  const rawThumbUrl = firstVideo
    ? firstVideo.thumbnail_url ||
      `https://img.youtube.com/vi/${firstVideo.youtube_id}/maxresdefault.jpg`
    : null;

  // Validate main thumbnail, fall back to hqdefault
  const thumbnailUrl = rawThumbUrl
    ? (await checkImage(rawThumbUrl)) ??
      (await checkImage(
        `https://img.youtube.com/vi/${firstVideo!.youtube_id}/hqdefault.jpg`
      ))
    : null;

  // Validate small thumbnails in parallel, skip any that error
  const smallThumbs: { youtube_id: string; url: string }[] = [];
  if (videos && videos.length > 1) {
    const checks = await Promise.all(
      videos.slice(1, 6).map(async (v) => {
        const url =
          v.thumbnail_url ||
          `https://img.youtube.com/vi/${v.youtube_id}/maxresdefault.jpg`;
        const valid =
          (await checkImage(url)) ??
          (await checkImage(
            `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`
          ));
        return valid ? { youtube_id: v.youtube_id, url: valid } : null;
      })
    );
    for (const t of checks) {
      if (t && smallThumbs.length < 3) smallThumbs.push(t);
    }
  }

  // Frogo logo — the horizontal version with mascot + "frogo" text
  const logoUrl = "https://frogo.tv/images/frogo/logo.png";

  return new ImageResponse(
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
        {/* === Full-bleed thumbnail === */}
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

        {/* === Dark gradient — heavier at bottom for text === */}
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

        {/* === Play button — centered on thumbnail === */}
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

        {/* === Bottom bar: logo + channel name === */}
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
          {/* Frogo logo */}
          <img
            src={logoUrl}
            alt="frogo.tv"
            style={{
              height: "120px",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />

          {/* Channel name */}
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

        {/* === Accent line === */}
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
    { ...size }
  );
}
