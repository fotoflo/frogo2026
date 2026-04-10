/**
 * OAuth 2.1 Token Endpoint.
 *
 *   POST /api/oauth/token
 *   Content-Type: application/x-www-form-urlencoded
 *   grant_type=authorization_code
 *   code=<code>
 *   code_verifier=<pkce_verifier>
 *   client_id=<client_id>
 *   redirect_uri=<redirect_uri>
 *
 * Verifies the code + PKCE verifier, mints a bearer token, stores the
 * hash in mcp_access_tokens, and returns the plain token to the client.
 * The auth code is single-use — deleted on success or failure.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { generateToken, hashToken, verifyPkce } from "@/lib/mcp-auth";

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function error(code: string, description: string, status = 400) {
  return NextResponse.json(
    { error: code, error_description: description },
    { status, headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: Request) {
  // Accept either form-encoded or JSON for robustness.
  let params: URLSearchParams;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    params = new URLSearchParams(text);
  } else if (contentType.includes("application/json")) {
    const body = await request.json();
    params = new URLSearchParams(body as Record<string, string>);
  } else {
    // Fall back to URL query string.
    params = new URL(request.url).searchParams;
  }

  const grantType = params.get("grant_type");
  const code = params.get("code");
  const codeVerifier = params.get("code_verifier");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");

  if (grantType !== "authorization_code") {
    return error("unsupported_grant_type", "only authorization_code is supported");
  }
  if (!code || !codeVerifier || !clientId || !redirectUri) {
    return error("invalid_request", "missing required parameter");
  }

  const supabase = createServiceClient();

  const { data: authCode, error: codeErr } = await supabase
    .from("mcp_auth_codes")
    .select(
      "code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, expires_at"
    )
    .eq("code", code)
    .maybeSingle();

  if (codeErr || !authCode) {
    return error("invalid_grant", "unknown or expired code");
  }

  // Single-use: delete the code before any further checks so a failed
  // attempt can't be retried.
  await supabase.from("mcp_auth_codes").delete().eq("code", code);

  if (new Date(authCode.expires_at).getTime() < Date.now()) {
    return error("invalid_grant", "code expired");
  }
  if (authCode.client_id !== clientId) {
    return error("invalid_grant", "client_id mismatch");
  }
  if (authCode.redirect_uri !== redirectUri) {
    return error("invalid_grant", "redirect_uri mismatch");
  }
  if (!verifyPkce(codeVerifier, authCode.code_challenge, authCode.code_challenge_method)) {
    return error("invalid_grant", "PKCE verification failed");
  }

  // Mint the access token.
  const accessToken = generateToken(32);
  const tokenHash = hashToken(accessToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();

  const { error: insertErr } = await supabase.from("mcp_access_tokens").insert({
    token_hash: tokenHash,
    client_id: authCode.client_id,
    user_id: authCode.user_id,
    scope: authCode.scope,
    expires_at: expiresAt,
  });

  if (insertErr) {
    return error("server_error", "could not persist access token", 500);
  }

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: TOKEN_TTL_SECONDS,
      scope: authCode.scope,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
