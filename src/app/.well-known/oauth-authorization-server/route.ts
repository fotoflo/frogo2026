/**
 * OAuth 2.1 Authorization Server Metadata (RFC 8414).
 *
 * Advertised to MCP clients at
 *   GET /.well-known/oauth-authorization-server
 *
 * Frogo acts as its own AS and wraps Supabase's Google provider internally.
 * From the MCP client's perspective it's a standard OAuth 2.1 + PKCE + DCR
 * server with a single scope: `frogo:curate`.
 */
import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/mcp-auth";

export async function GET(request: Request) {
  const issuer = getIssuer(request);
  return NextResponse.json({
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    scopes_supported: ["frogo:curate"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  });
}
