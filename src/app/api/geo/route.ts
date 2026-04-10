import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const rawLat = request.headers.get("x-vercel-ip-latitude");
  const rawLng = request.headers.get("x-vercel-ip-longitude");
  const rawCity = request.headers.get("x-vercel-ip-city");

  const latitude = rawLat || "40.7128";
  const longitude = rawLng || "-74.0060";
  const city = rawCity
    ? decodeURIComponent(rawCity)
    : rawLat
      ? "Here"
      : "New York";

  return NextResponse.json({
    lat: parseFloat(latitude),
    lng: parseFloat(longitude),
    city,
  });
}
