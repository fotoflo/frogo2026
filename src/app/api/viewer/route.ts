import { NextResponse } from "next/server";
import { getOrCreateViewer } from "@/lib/viewer";

export async function GET() {
  try {
    const viewer = await getOrCreateViewer();
    return NextResponse.json({ viewerId: viewer.id });
  } catch {
    return NextResponse.json({ error: "Failed to get viewer" }, { status: 500 });
  }
}
