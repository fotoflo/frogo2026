/**
 * OAuth consent page.
 *
 *   GET  /api/oauth/consent   → render approve/deny form
 *   POST /api/oauth/consent   → mint auth code and redirect to MCP client
 *
 * The user lands here after completing Google signin via /api/auth/signin.
 * We read the session_id cookie set by /api/oauth/authorize, look up the
 * pending PKCE state, confirm the Supabase session is populated, and show
 * a minimal "Authorize <client_name>?" screen.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { generateToken } from "@/lib/mcp-auth";

const AUTH_SESSION_COOKIE = "frogo_mcp_auth_session";
// OAuth 2.1 recommends "short-lived" codes — 10 minutes is the practical
// upper bound. We used 60s originally but that's too tight: any hiccup
// between the redirect back to the client and their token exchange burns
// the window and the user has to restart the flow.
const CODE_TTL_SECONDS = 600;

async function loadSession(sessionId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("mcp_auth_sessions")
    .select(
      "session_id, client_id, redirect_uri, code_challenge, code_challenge_method, state, scope, expires_at"
    )
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function loadClient(clientId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("mcp_clients")
    .select("client_name")
    .eq("client_id", clientId)
    .maybeSingle();
  return data;
}

function renderConsent(params: {
  clientName: string;
  userEmail: string;
  scope: string;
}) {
  const { clientName, userEmail, scope } = params;
  const safeClient = escapeHtml(clientName);
  const safeEmail = escapeHtml(userEmail);
  const safeScope = escapeHtml(scope);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize ${safeClient} — Frogo</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0a0a0a;
      color: #f5f5f5;
      font-family: -apple-system, system-ui, sans-serif;
      padding: 24px;
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: #141414;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 32px;
    }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: #a3a3a3; line-height: 1.5; margin: 8px 0; font-size: 14px; }
    strong { color: #fff; }
    .scope {
      margin: 20px 0;
      padding: 12px 14px;
      background: rgba(124,92,252,0.08);
      border: 1px solid rgba(124,92,252,0.3);
      border-radius: 8px;
      font-size: 13px;
      color: #d4c5ff;
    }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button {
      flex: 1;
      padding: 12px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
    .approve { background: #7c5cfc; color: #fff; }
    .approve:hover { background: #6b4ee8; }
    .deny { background: transparent; color: #a3a3a3; border: 1px solid rgba(255,255,255,0.15); }
    .deny:hover { background: rgba(255,255,255,0.05); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize <strong>${safeClient}</strong>?</h1>
    <p>Signed in as <strong>${safeEmail}</strong></p>
    <p>This app is requesting access to manage your Frogo channels on your behalf.</p>
    <div class="scope">Scope: ${safeScope}</div>
    <form method="POST" action="/api/oauth/consent">
      <div class="actions">
        <button type="submit" name="decision" value="deny" class="deny">Deny</button>
        <button type="submit" name="decision" value="approve" class="approve">Authorize</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const sessionId = getSessionCookie(request);
  if (!sessionId) {
    return NextResponse.redirect(`${origin}/auth/error?error=missing_session`);
  }

  const session = await loadSession(sessionId);
  if (!session) {
    return NextResponse.redirect(`${origin}/auth/error?error=invalid_session`);
  }

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(
      `${origin}/api/auth/signin?next=${encodeURIComponent("/api/oauth/consent")}`
    );
  }

  const client = await loadClient(session.client_id);
  const html = renderConsent({
    clientName: client?.client_name ?? session.client_id,
    userEmail: userData.user.email ?? "(unknown)",
    scope: session.scope,
  });

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const sessionId = getSessionCookie(request);
  if (!sessionId) {
    return NextResponse.redirect(`${origin}/auth/error?error=missing_session`);
  }

  const session = await loadSession(sessionId);
  if (!session) {
    return NextResponse.redirect(`${origin}/auth/error?error=invalid_session`);
  }

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(`${origin}/auth/error?error=not_signed_in`);
  }

  const form = await request.formData();
  const decision = form.get("decision");

  const service = createServiceClient();

  // Clean up the pending session either way.
  const cleanupSession = () =>
    service.from("mcp_auth_sessions").delete().eq("session_id", sessionId);

  if (decision !== "approve") {
    await cleanupSession();
    const redirect = new URL(session.redirect_uri);
    redirect.searchParams.set("error", "access_denied");
    if (session.state) redirect.searchParams.set("state", session.state);
    const response = NextResponse.redirect(redirect);
    response.cookies.delete(AUTH_SESSION_COOKIE);
    return response;
  }

  // Approve: mint the auth code.
  const code = generateToken(24);
  const codeExpiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
  const { error: insertErr } = await service.from("mcp_auth_codes").insert({
    code,
    client_id: session.client_id,
    user_id: userData.user.id,
    redirect_uri: session.redirect_uri,
    code_challenge: session.code_challenge,
    code_challenge_method: session.code_challenge_method,
    scope: session.scope,
    expires_at: codeExpiresAt,
  });

  if (insertErr) {
    return NextResponse.redirect(`${origin}/auth/error?error=server_error`);
  }

  await cleanupSession();

  const redirect = new URL(session.redirect_uri);
  redirect.searchParams.set("code", code);
  if (session.state) redirect.searchParams.set("state", session.state);
  const response = NextResponse.redirect(redirect);
  response.cookies.delete(AUTH_SESSION_COOKIE);
  return response;
}

function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === AUTH_SESSION_COOKIE) return rest.join("=");
  }
  return null;
}
