# MCP OAuth 2.1 Authorization Server

Frogo acts as its own OAuth 2.1 authorization server so that third-party Claude/MCP clients can authenticate Frogo users and curate channels on their behalf. Internally the flow wraps Supabase Auth's existing Google provider — from the MCP client's perspective it's a standard OAuth 2.1 server with Dynamic Client Registration, PKCE (S256), and the authorization code grant.

The goal is multi-tenant channel curation: anyone with a Claude instance can register a client, sign in with Google, and get a bearer token scoped to `frogo:curate` that lets their MCP tools manage their own channels.

## Key Files

- `supabase/migrations/20260410020000_mcp_auth.sql` — four tables: `mcp_clients`, `mcp_auth_sessions`, `mcp_auth_codes`, `mcp_access_tokens`. RLS enabled, no public policies — service-role only.
- `src/lib/mcp-auth.ts` — token generation/hashing, S256 PKCE verification, `resolveBearerToken()` for `/api/mcp`, and `getIssuer()` helper.
- `src/app/.well-known/oauth-authorization-server/route.ts` — RFC 8414 AS metadata (endpoints, supported grants, S256, `token_endpoint_auth_methods_supported: ["none"]`).
- `src/app/.well-known/oauth-protected-resource/route.ts` — RFC 9728 protected-resource metadata. Points MCP clients at the AS that protects `/api/mcp`.
- `src/app/api/oauth/register/route.ts` — RFC 7591 Dynamic Client Registration. Accepts any `client_name` + `redirect_uris`, issues a random `mcp_*` client_id. Public clients only (no secret). Validates `http` only allowed for localhost.
- `src/app/api/oauth/authorize/route.ts` — Authorization endpoint. Validates client + redirect_uri, persists pending PKCE state in `mcp_auth_sessions` (10m TTL), sets a session_id cookie, and hands off to `/api/auth/signin?next=/api/oauth/consent`.
- `src/app/api/oauth/consent/route.ts` — GET renders a minimal approve/deny HTML form; POST mints an auth code into `mcp_auth_codes` (60s TTL) and redirects to the client's `redirect_uri` with `code` + `state`.
- `src/app/api/oauth/token/route.ts` — Token endpoint. Accepts form or JSON. Looks up the code, deletes it before validation (single-use), checks expiry/client/redirect/PKCE, mints a bearer token, stores only its SHA-256 hash in `mcp_access_tokens` (30d TTL).
- `src/lib/supabase.ts` — provides `createServiceClient()` used by every OAuth route for DB writes (no RLS policies exist on the MCP tables).
- `src/lib/supabase-server.ts` — provides the cookie-aware server client used in `/api/oauth/consent` to read the current Supabase user via `supabase.auth.getUser()`.
- `src/app/api/auth/signin/route.ts` — existing Frogo Google signin. Reused verbatim by the authorize endpoint via the `next` query param.

## OAuth Flow

```
┌──────────┐                    ┌──────────┐              ┌──────────┐
│ MCP      │                    │ Frogo    │              │ Supabase │
│ Client   │                    │ AS       │              │ Google   │
└────┬─────┘                    └────┬─────┘              └────┬─────┘
     │                               │                         │
     │ 1. POST /api/oauth/register   │                         │
     │    { client_name,             │                         │
     │      redirect_uris }          │                         │
     │ ─────────────────────────────►│                         │
     │ ◄── client_id ────────────────│                         │
     │                               │                         │
     │ 2. GET /api/oauth/authorize   │                         │
     │    ?client_id                 │                         │
     │    &redirect_uri              │                         │
     │    &code_challenge (S256)     │                         │
     │    &state                     │                         │
     │ ─────────────────────────────►│                         │
     │                               │  INSERT mcp_auth_session │
     │                               │  set cookie session_id   │
     │                               │  redirect → signin       │
     │                               │ ────────────────────────►│
     │                               │                         │
     │                               │  (Google OAuth dance)   │
     │                               │ ◄────────────────────────│
     │                               │                         │
     │ 3. GET /api/oauth/consent     │                         │
     │    (user approves)            │                         │
     │                               │  INSERT mcp_auth_code    │
     │                               │  DELETE mcp_auth_session │
     │                               │                         │
     │ 4. 302 redirect_uri?code=...  │                         │
     │ ◄──────────────────────────── │                         │
     │                               │                         │
     │ 5. POST /api/oauth/token      │                         │
     │    grant_type=auth_code       │                         │
     │    code=...                   │                         │
     │    code_verifier=...          │                         │
     │ ─────────────────────────────►│                         │
     │                               │  DELETE mcp_auth_code    │
     │                               │  verify PKCE S256        │
     │                               │  INSERT mcp_access_token │
     │                               │    (SHA-256 hash only)   │
     │ ◄── access_token ─────────────│                         │
     │                               │                         │
     │ 6. Bearer → /api/mcp          │                         │
     │    (future)                   │                         │
     │                               │                         │
```

## Tables

| Table | Lifetime | Purpose |
|---|---|---|
| `mcp_clients` | Permanent | One row per registered MCP client. Stores `client_id`, `client_name`, `redirect_uris[]`. No client secret. |
| `mcp_auth_sessions` | 10 minutes | In-flight authorize requests. Holds PKCE challenge + state between `/authorize` and `/consent`. Keyed by a random `session_id` stashed in an `httpOnly` cookie named `frogo_mcp_auth_session`. Deleted on approve or deny. |
| `mcp_auth_codes` | 60 seconds | Single-use authorization codes bound to `user_id` + PKCE challenge + `redirect_uri`. Deleted at the start of `/token` before any validation, so a bad request can't be retried. |
| `mcp_access_tokens` | 30 days | Issued bearer tokens. Only `token_hash` (SHA-256) is stored — the plaintext token exists only in the response body. Tracks `last_used_at` (fire-and-forget update) and `revoked_at`. |

## Important Patterns

- **Single-use auth codes by delete-first.** `/api/oauth/token` deletes the row from `mcp_auth_codes` before it checks expiry, client_id match, redirect_uri match, or PKCE. This guarantees no replay even if one of the validations fails.
- **Tokens are never stored in plaintext.** `mcp-auth.ts` uses `crypto.createHash("sha256")` for `token_hash`. A full DB dump cannot be replayed as tokens. `resolveBearerToken()` hashes the incoming bearer and looks up by `token_hash`.
- **Timing-safe comparisons.** `verifyPkce` uses `crypto.timingSafeEqual` via `timingSafeEqualStrings`.
- **S256 PKCE required, `plain` forbidden.** Per OAuth 2.1 + MCP spec. Verifier length enforced to 43–128 chars.
- **Public clients only.** `token_endpoint_auth_methods_supported: ["none"]` — no client secret. PKCE is the only proof-of-possession. DCR is intentionally open because clients can't do anything without a user completing the full flow.
- **Service-role-only DB access.** All four `mcp_*` tables have RLS enabled with zero policies. Every route uses `createServiceClient()`. The consent route additionally uses `createClient()` from `supabase-server.ts` purely to read the signed-in user via the existing Supabase Auth cookies.
- **Issuer resolution.** `getIssuer()` prefers `NEXT_PUBLIC_SITE_URL` (so preview and prod issuers are stable) and falls back to the request origin.
- **TTLs:** authorize session 600s, auth code 60s, access token 30 days. All enforced by `expires_at` timestamp comparison at read time.
- **Redirect URI allowlist at authorize-time.** The requested `redirect_uri` must be a literal match against `mcp_clients.redirect_uris`. `http://` only allowed for `localhost` / `127.0.0.1` at registration time (for Claude Desktop callbacks).

## Status

The OAuth 2.1 authorization server is complete and ready to issue tokens. What is **not** yet wired up:

- `/api/mcp` — the actual MCP JSON-RPC endpoint that consumes the bearer via `resolveBearerToken()`. Not implemented this session.
- Curation tools (create/update channels, add/remove videos, reorder playlists). These are blocked on the parallel **channel-hierarchy refactor** landing — the new schema will determine the tool surface.

Until `/api/mcp` lands, the flow can be exercised end-to-end (register → authorize → consent → token) but the resulting bearer has no resource to call.
