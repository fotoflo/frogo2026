import { ImageResponse } from "next/og";

export const alt = "Frogo.tv — Curated channels, always on";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoUrl = "https://frogo.tv/images/frogo/logo.png";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background:
            "linear-gradient(135deg, #0d0d15 0%, #1a1a2e 50%, #0d0d15 100%)",
          padding: "72px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(124,92,252,0.18) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          style={{
            height: "180px",
            objectFit: "contain",
            marginBottom: "40px",
            filter: "drop-shadow(0 8px 32px rgba(124,92,252,0.35))",
          }}
        />

        <div
          style={{
            fontSize: "88px",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            textAlign: "center",
            textShadow: "0 2px 24px rgba(0,0,0,0.5)",
          }}
        >
          Curated channels. Always on.
        </div>

        <div
          style={{
            fontSize: "32px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.7)",
            marginTop: "28px",
            textAlign: "center",
            letterSpacing: "-0.01em",
          }}
        >
          Hand-picked folders, looping around the clock. No junk.
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "32px",
            fontSize: "22px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          frogo.tv
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
    { ...size }
  );
}
