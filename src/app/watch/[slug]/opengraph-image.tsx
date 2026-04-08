import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const alt = "Frogo.tv Channel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Revalidate daily — refreshes the thumbnail from the first video
export const revalidate = 86400;

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
    .limit(1);

  const name = channel?.name ?? slug;
  const icon = channel?.icon ?? "📺";
  const firstVideo = videos?.[0];
  // Use maxresdefault for best quality, fall back to hqdefault
  const thumbnailUrl = firstVideo
    ? `https://img.youtube.com/vi/${firstVideo.youtube_id}/maxresdefault.jpg`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          background: "#0d0d15",
        }}
      >
        {/* Video thumbnail as full background */}
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

        {/* Dark gradient overlay — heavier at bottom for text readability */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background: thumbnailUrl
              ? "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.7) 75%, rgba(0,0,0,0.9) 100%)"
              : "linear-gradient(135deg, #0d0d15 0%, #1a1a2e 40%, #0d0d15 100%)",
          }}
        />

        {/* Top-left: frogo.tv branding */}
        <div
          style={{
            position: "absolute",
            top: "36px",
            left: "44px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "26px", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
            frogo
          </div>
          <div style={{ fontSize: "26px", color: "#7c5cfc", fontWeight: 600 }}>
            .tv
          </div>
        </div>

        {/* Top-right: ON AIR badge */}
        <div
          style={{
            position: "absolute",
            top: "36px",
            right: "44px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(0,0,0,0.5)",
            borderRadius: "8px",
            padding: "8px 16px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#ef4444",
            }}
          />
          <div
            style={{
              fontSize: "18px",
              color: "#ef4444",
              fontWeight: 700,
              letterSpacing: "0.12em",
            }}
          >
            ON AIR
          </div>
        </div>

        {/* Bottom: channel info bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "flex-end",
            padding: "0 44px 40px 44px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {/* Channel */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
              <span style={{ fontSize: "56px" }}>{icon}</span>
              <div
                style={{
                  fontSize: "52px",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                }}
              >
                {name}
              </div>
            </div>
            {/* Now playing label */}
            {firstVideo && (
              <div
                style={{
                  fontSize: "22px",
                  color: "rgba(255,255,255,0.6)",
                  textShadow: "0 1px 8px rgba(0,0,0,0.5)",
                  marginLeft: "4px",
                }}
              >
                Now playing: {firstVideo.title.length > 60 ? firstVideo.title.slice(0, 60) + "..." : firstVideo.title}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
