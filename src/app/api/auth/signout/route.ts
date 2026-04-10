/**
 * Sign-out — clears the session cookie and redirects home.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
