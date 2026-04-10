/**
 * OAuth 2.1 Authorization Endpoint.
 *
 *   GET /api/oauth/authorize
 *     ?client_id=...
 *     &redirect_uri=...
 *     &response_type=code
 *     &code_challenge=...
 *     &code_challenge_method=S256
 *     &state=...
 *     &scope=frogo:curate
 *
 * Flow:
 *   1. Validate client_id + redirect_uri against mcp_clients
 *   2. Persist the pending PKCE state in mcp_auth_sessions (10m TTL)
 *   3. Set a cookie with the session_id so /api/oauth/consent can find it
 *   4. Redirect to /api/auth/signin?next=/api/oauth/consent — reuses
 *      Frogo's existing Supabase Google signin flow
 *
 * After Google auth, the user lands at /api/oauth/consent which reads the
 * cookie, validates that they approved, and mints an auth code.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { generateToken } from "@/lib/mcp-auth";

const AUTH_SESSION_COOKIE = "frogo_mcp_auth_session";
const SESSION_TTL_SECONDS = 600; // 10 minutes

function errorRedirect(origin: string, error: string, description: string) {
  const url = new URL(`${origin}/auth/error`);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const responseType = searchParams.get("response_type");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");
  const state = searchParams.get("state");
  const scope = searchParams.get("scope") ?? "frogo:curate";

  if (!clientId || !redirectUri) {
    return errorRedirect(origin, "invalid_request", "client_id and redirect_uri are required");
  }
  if (responseType !== "code") {
    return errorRedirect(origin, "unsupported_response_type", "only 'code' is supported");
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return errorRedirect(origin, "invalid_request", "PKCE S256 challenge is required");
  }

  // Validate the client and its redirect_uri allowlist.
  const supabase = createServiceClient();
  const { data: client, error: clientErr } = await supabase
    .from("mcp_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();

  if (clientErr || !client) {
    return errorRedirect(origin, "invalid_client", "unknown client_id");
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return errorRedirect(origin, "invalid_redirect_uri", "redirect_uri not registered");
  }

  // Persist the pending authorize request.
  const sessionId = generateToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const { error: insertErr } = await supabase.from("mcp_auth_sessions").insert({
    session_id: sessionId,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    state,
    scope,
    expires_at: expiresAt,
  });

  if (insertErr) {
    return errorRedirect(origin, "server_error", "could not persist authorize request");
  }

  // Hand off to the existing Supabase Google signin. After Google, the
  // callback will redirect to /api/oauth/consent which reads our cookie.
  const response = NextResponse.redirect(
    `${origin}/api/auth/signin?next=${encodeURIComponent("/api/oauth/consent")}`
  );
  response.cookies.set(AUTH_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
