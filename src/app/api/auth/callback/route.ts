/**
 * OAuth callback — Google redirects here with `?code=...` after sign-in.
 *
 * Exchanges the code for a session cookie, then:
 *   1. Bumps the profile's login counter and last_login timestamp.
 *   2. If the profile has god_mode, runs a one-shot ownership claim on any
 *      channels with owner_id IS NULL — idempotent, no-op after first win.
 *
 * Profile rows are auto-created by the on_auth_user_created trigger
 * (supabase/migrations/20260411000000_profiles.sql), which also auto-promotes
 * fotoflo@gmail.com to god_mode.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getIssuer } from "@/lib/mcp-auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Prefer x-forwarded-host — otherwise local dev via ngrok redirects
  // the browser to https://localhost:5555 and the page won't load.
  const origin = getIssuer(request);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/admin";
  if (!next.startsWith("/")) next = "/admin";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  const service = createServiceClient();

  // Bump login stats. Uses a raw increment so concurrent sign-ins don't
  // lose counts.
  await service.rpc("increment_profile_login", { profile_id: data.user.id });

  // Fetch god_mode to decide on the ownership claim.
  const { data: profile } = await service
    .from("profiles")
    .select("god_mode")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.god_mode) {
    await service
      .from("channels")
      .update({ owner_id: data.user.id })
      .is("owner_id", null);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
