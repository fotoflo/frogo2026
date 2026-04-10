/**
 * OAuth callback — Google redirects here with `?code=...` after sign-in.
 *
 * Exchanges the code for a session cookie, then runs the one-shot ownership
 * claim: if the user's email matches ADMIN_EMAIL, any channels with
 * owner_id IS NULL get assigned to them. This only fires on successful
 * exchange; idempotent so re-signing in is a no-op.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
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

  // Ownership claim — runs on every sign-in but is a no-op after first success.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && data.user.email === adminEmail) {
    const service = createServiceClient();
    await service
      .from("channels")
      .update({ owner_id: data.user.id })
      .is("owner_id", null);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`);
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  } else {
    return NextResponse.redirect(`${origin}${next}`);
  }
}
