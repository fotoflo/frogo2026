/**
 * Dynamic Client Registration endpoint (RFC 7591).
 *
 *   POST /api/oauth/register
 *
 * MCP clients call this before the authorization flow to get a client_id.
 * We accept any client_name + redirect_uris, issue a random client_id, and
 * store it. No client secret — public clients only (PKCE-protected).
 *
 * This is intentionally open: MCP spec requires dynamic registration to work
 * without operator intervention. Abuse is bounded because clients can't do
 * anything without a user completing the authorization flow.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { generateToken } from "@/lib/mcp-auth";

interface RegisterBody {
  client_name?: string;
  redirect_uris?: string[];
}

export async function POST(request: Request) {
  console.log("[oauth/register] POST", {
    ua: request.headers.get("user-agent"),
  });
  let body: RegisterBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const clientName = (body.client_name ?? "").trim() || "Unnamed MCP Client";
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris is required" },
      { status: 400 }
    );
  }

  // Basic sanity — all must be http/https URLs. http is allowed for
  // localhost callbacks (Claude Desktop etc.).
  for (const uri of redirectUris) {
    try {
      const u = new URL(uri);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        throw new Error("bad scheme");
      }
      if (u.protocol === "http:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
        throw new Error("http only allowed for localhost");
      }
    } catch {
      return NextResponse.json(
        { error: "invalid_redirect_uri", error_description: `Invalid redirect_uri: ${uri}` },
        { status: 400 }
      );
    }
  }

  const clientId = `mcp_${generateToken(16)}`;
  const supabase = createServiceClient();
  const { error } = await supabase.from("mcp_clients").insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
  });

  if (error) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // RFC 7591 §3.2.1 — the response includes the client's metadata plus
  // `client_id_issued_at` (unix seconds). For public clients with no
  // client_secret, `client_secret_expires_at: 0` is the conventional way
  // to say "no secret, nothing to expire" — some OAuth libraries reject
  // the response if it's missing.
  const nowSec = Math.floor(Date.now() / 1000);
  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: nowSec,
      client_secret_expires_at: 0,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    { status: 201 }
  );
}
