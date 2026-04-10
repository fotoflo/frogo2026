/**
 * MCP OAuth auth helpers — token generation/hashing, PKCE verification,
 * and bearer-token → user_id resolution for the /api/mcp route.
 *
 * Design notes:
 * - Access tokens are 32 random bytes (hex). We store only SHA-256 hashes
 *   in mcp_access_tokens, so a DB leak can't be replayed.
 * - PKCE uses S256 only. Plain is forbidden per MCP spec.
 * - All timing-sensitive comparisons use crypto.timingSafeEqual.
 */
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Generate a random hex token of `bytes * 2` characters. */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Stable hash of a token for DB storage. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** base64url without padding — used for PKCE challenges. */
export function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Verify a PKCE code_verifier against a stored challenge.
 * Only S256 is supported (`plain` is forbidden by OAuth 2.1 + MCP spec).
 */
export function verifyPkce(
  verifier: string,
  challenge: string,
  method: string
): boolean {
  if (method !== "S256") return false;
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  const hash = crypto.createHash("sha256").update(verifier).digest();
  const computed = base64url(hash);
  return timingSafeEqualStrings(computed, challenge);
}

/** Constant-time string comparison. */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface ResolvedToken {
  userId: string;
  clientId: string;
  scope: string;
  tokenHash: string;
}

/**
 * Look up a bearer token in mcp_access_tokens. Returns the resolved user
 * or null if the token is missing, expired, or revoked. Bumps last_used_at
 * on success (fire-and-forget, don't await).
 *
 * Caller must provide a service-role Supabase client — this table has no
 * public RLS policies.
 */
export async function resolveBearerToken(
  supabase: SupabaseClient,
  authHeader: string | null
): Promise<ResolvedToken | null> {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ", 2);
  if (scheme !== "Bearer" || !token) return null;

  const tokenHash = hashToken(token);
  const { data, error } = await supabase
    .from("mcp_access_tokens")
    .select("user_id, client_id, scope, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  // Fire-and-forget update of last_used_at. Don't block the request on this.
  void supabase
    .from("mcp_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  return {
    userId: data.user_id,
    clientId: data.client_id,
    scope: data.scope,
    tokenHash,
  };
}

/** Resolve the public base URL for this deployment (issuer + redirect targets). */
export function getIssuer(request: Request): string {
  // Explicit env var wins (useful for preview.frogo.tv vs frogo.tv).
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  // Fall back to the request's own origin.
  return new URL(request.url).origin;
}
