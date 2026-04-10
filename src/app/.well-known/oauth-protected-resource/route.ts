/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * Advertised to MCP clients at
 *   GET /.well-known/oauth-protected-resource
 *
 * Tells clients which authorization server(s) protect /api/mcp. For Frogo
 * the protected resource and the AS are the same host.
 */
import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/mcp-auth";

export async function GET(request: Request) {
  const issuer = getIssuer(request);
  return NextResponse.json({
    resource: `${issuer}/api/mcp`,
    authorization_servers: [issuer],
    scopes_supported: ["frogo:curate"],
    bearer_methods_supported: ["header"],
  });
}
