import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const url = readFileSync(join(process.cwd(), ".ngrok-url"), "utf-8").trim();
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ url: null });
  }
}
