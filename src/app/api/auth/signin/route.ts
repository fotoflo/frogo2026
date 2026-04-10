/**
 * Sign-in initiator — starts Google OAuth flow.
 *
 * Redirects to Supabase's authorize endpoint which bounces to Google, then
 * back to /api/auth/callback with a code. Accepts an optional ?next= query
 * param so we can return the user to where they came from.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/admin";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  return NextResponse.redirect(data.url);
}
