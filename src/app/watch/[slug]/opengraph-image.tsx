import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const alt = "Frogo.tv Channel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
    .select("title, thumbnail_url")
    .eq("channel_id", channel?.id ?? "")
    .order("position")
    .limit(4);

  const name = channel?.name ?? slug;
  const icon = channel?.icon ?? "📺";
  const description = channel?.description ?? "";
  const videoCount = videos?.length ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0d0d15 0%, #1a1a2e 40%, #0d0d15 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 70px",
          position: "relative",
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(124, 92, 252, 0.12)",
            filter: "blur(80px)",
          }}
        />

        {/* Header: logo + branding */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "48px" }}>
          <div
            style={{
              fontSize: "32px",
              color: "rgba(255,255,255,0.5)",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            frogo
          </div>
          <div
            style={{
              fontSize: "32px",
              color: "#7c5cfc",
              fontWeight: 600,
            }}
          >
            .tv
          </div>
        </div>

        {/* Channel info */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "20px" }}>
            <span style={{ fontSize: "72px" }}>{icon}</span>
            <div
              style={{
                fontSize: "64px",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>
          </div>

          {description && (
            <div
              style={{
                fontSize: "28px",
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.4,
                maxWidth: "800px",
              }}
            >
              {description.length > 120 ? description.slice(0, 120) + "..." : description}
            </div>
          )}
        </div>

        {/* Footer: video count + ON AIR badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#ef4444",
              }}
            />
            <div
              style={{
                fontSize: "22px",
                color: "#ef4444",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase" as const,
              }}
            >
              ON AIR
            </div>
          </div>

          {videoCount > 0 && (
            <div
              style={{
                fontSize: "20px",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {videoCount} video{videoCount !== 1 ? "s" : ""} in rotation
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
