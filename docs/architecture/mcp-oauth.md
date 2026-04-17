# MCP OAuth 2.1 Authorization Server

Frogo acts as its own OAuth 2.1 authorization server so that third-party Claude/MCP clients can authenticate Frogo users and curate channels on their behalf. Internally the flow wraps Supabase Auth's existing Google provider — from the MCP client's perspective it's a standard OAuth 2.1 server with Dynamic Client Registration, PKCE (S256), and the authorization code grant.

The goal is multi-tenant channel curation: anyone with a Claude instance can register a client, sign in with Google, and get a bearer token scoped to `frogo:curate` that lets their MCP tools manage their own channels.

## Key Files

- `supabase/migrations/20260410020000_mcp_auth.sql` — four tables: `mcp_clients`, `mcp_auth_sessions`, `mcp_auth_codes`, `mcp_access_tokens`. RLS enabled, no public policies — service-role only.
- `src/lib/mcp-auth.ts` — token generation/hashing, S256 PKCE verification, `resolveBearerToken()` for `/api/mcp`, and `getIssuer()` helper (honors `x-forwarded-host`/`x-forwarded-proto`).
- `src/lib/youtube-api.ts` — YouTube Data API v3 wrapper used by every video-write tool (`add_video`, `add_videos_bulk`, `refresh_video_metadata`, `import_youtube_playlist`, `import_youtube_channel`). See [YouTube Metadata](youtube-metadata.md) for the full story.
- `src/app/.well-known/oauth-authorization-server/route.ts` — RFC 8414 AS metadata (endpoints, supported grants, S256, `token_endpoint_auth_methods_supported: ["none"]`).
- `src/app/.well-known/oauth-protected-resource/route.ts` — RFC 9728 protected-resource metadata. Points MCP clients at the AS that protects `/api/mcp`.
- `src/app/api/oauth/register/route.ts` — RFC 7591 Dynamic Client Registration. Accepts any `client_name` + `redirect_uris`, issues a random `mcp_*` client_id. Public clients only (no secret). Validates `http` only allowed for localhost.
- `src/app/api/oauth/authorize/route.ts` — Authorization endpoint. Validates client + redirect_uri, persists pending PKCE state in `mcp_auth_sessions` (10m TTL), sets a session_id cookie, and hands off to `/api/auth/signin?next=/api/oauth/consent`.
- `src/app/api/oauth/consent/route.ts` — GET renders a minimal approve/deny HTML form; POST mints an auth code into `mcp_auth_codes` (10m TTL) and **303**-redirects to the client's `redirect_uri` with `code` + `state` (POST→GET transition must be 303, not 307).
- `src/app/api/oauth/token/route.ts` — Token endpoint. Accepts form or JSON. Looks up the code, deletes it before validation (single-use), checks expiry/client/redirect/PKCE, mints a bearer token, stores only its SHA-256 hash in `mcp_access_tokens` (30d TTL).
- `src/lib/supabase.ts` — provides `createServiceClient()` used by every OAuth route for DB writes (no RLS policies exist on the MCP tables).
- `src/lib/supabase-server.ts` — provides the cookie-aware server client used in `/api/oauth/consent` to read the current Supabase user via `supabase.auth.getUser()`.
- `src/app/api/auth/signin/route.ts` — existing Frogo Google signin. Reused verbatim by the authorize endpoint via the `next` query param.
- `src/app/api/mcp/route.ts` — MCP Streamable HTTP endpoint. JSON-RPC 2.0 over POST. Validates the bearer via `resolveBearerToken()`, enforces `frogo:curate` scope, exposes the channel curation tools below.

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
     │ 4. 303 redirect_uri?code=...  │                         │
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
     │    JSON-RPC tools/call        │                         │
     │                               │                         │
```

## Tables

| Table | Lifetime | Purpose |
|---|---|---|
| `mcp_clients` | Permanent | One row per registered MCP client. Stores `client_id`, `client_name`, `redirect_uris[]`. No client secret. |
| `mcp_auth_sessions` | 10 minutes | In-flight authorize requests. Holds PKCE challenge + state between `/authorize` and `/consent`. Keyed by a random `session_id` stashed in an `httpOnly` cookie named `frogo_mcp_auth_session`. Deleted on approve or deny. |
| `mcp_auth_codes` | 10 minutes | Single-use authorization codes bound to `user_id` + PKCE challenge + `redirect_uri`. Deleted at the start of `/token` before any validation, so a bad request can't be retried. Originally 60s but that was too tight — any latency hiccup between the consent redirect and the client's token exchange burned the window. |
| `mcp_access_tokens` | 30 days | Issued bearer tokens. Only `token_hash` (SHA-256) is stored — the plaintext token exists only in the response body. Tracks `last_used_at` (fire-and-forget update) and `revoked_at`. |

## Important Patterns

- **Single-use auth codes by delete-first.** `/api/oauth/token` deletes the row from `mcp_auth_codes` before it checks expiry, client_id match, redirect_uri match, or PKCE. This guarantees no replay even if one of the validations fails.
- **Tokens are never stored in plaintext.** `mcp-auth.ts` uses `crypto.createHash("sha256")` for `token_hash`. A full DB dump cannot be replayed as tokens. `resolveBearerToken()` hashes the incoming bearer and looks up by `token_hash`.
- **Timing-safe comparisons.** `verifyPkce` uses `crypto.timingSafeEqual` via `timingSafeEqualStrings`.
- **S256 PKCE required, `plain` forbidden.** Per OAuth 2.1 + MCP spec. Verifier length enforced to 43–128 chars.
- **Public clients only.** `token_endpoint_auth_methods_supported: ["none"]` — no client secret. PKCE is the only proof-of-possession. DCR is intentionally open because clients can't do anything without a user completing the full flow.
- **Service-role-only DB access.** All four `mcp_*` tables have RLS enabled with zero policies. Every route uses `createServiceClient()`. The consent route additionally uses `createClient()` from `supabase-server.ts` purely to read the signed-in user via the existing Supabase Auth cookies.
- **Issuer resolution.** `getIssuer()` prefers `NEXT_PUBLIC_SITE_URL` (stable across preview/prod), then honors `x-forwarded-host` + `x-forwarded-proto` (required for ngrok dev and any proxied deployment — otherwise discovery metadata leaks `localhost:5555`), then falls back to the request origin. **Every OAuth + Supabase-auth route** (`authorize`, `consent`, `token`, `signin`, `callback`, plus the `/api/mcp` `WWW-Authenticate` header) resolves URLs through `getIssuer()` — never `new URL(request.url).origin`.
- **POST redirects must be 303.** `NextResponse.redirect()` defaults to 307, which preserves the method. The consent POST handler (and any other POST→GET redirect in the flow) passes `{ status: 303 }` so the browser switches to GET on the client's `redirect_uri`. A 307 here causes the client to POST the `redirect_uri` and the flow dies silently.
- **`DELETE /api/mcp` returns 204, not 405.** The MCP Streamable HTTP spec says a stateless server MAY return 405 on `DELETE`, but the Claude.ai connector client wraps 405 in an error envelope and aborts. Same for `GET` — we return an empty SSE stream with a heartbeat comment instead of 405.
- **RFC 7591 register response shape.** `/api/oauth/register` returns `client_id_issued_at` (unix seconds) and `client_secret_expires_at: 0` alongside the client metadata. Strict OAuth clients reject responses missing these fields, even for public clients.
- **TTLs:** authorize session 600s, auth code 600s, access token 30 days. All enforced by `expires_at` timestamp comparison at read time.
- **Redirect URI allowlist at authorize-time.** The requested `redirect_uri` must be a literal match against `mcp_clients.redirect_uris`. `http://` only allowed for `localhost` / `127.0.0.1` at registration time (for Claude Desktop callbacks).

## MCP Endpoint

`POST /api/mcp` is a minimal JSON-RPC 2.0 Streamable HTTP transport. It implements the 2025-06-18 MCP revision just enough for Claude Desktop / Claude.ai connectors:

- `initialize` → returns `protocolVersion`, `capabilities.tools`, `serverInfo`
- `notifications/initialized`, `notifications/cancelled` → 202, no body
- `ping` → empty result
- `tools/list` → tool schemas below
- `tools/call` → dispatches by tool name, returns `{ content: [{ type: "text", text }] }`

On unauthenticated calls (or wrong scope) the endpoint returns `401` with:

```
WWW-Authenticate: Bearer resource_metadata="https://<host>/.well-known/oauth-protected-resource"
```

which is the MCP-spec-mandated discovery hint that triggers an OAuth flow in the client.

### Tools (scope `frogo:curate`)

All tools are scoped to the authenticated user via `owner_id` — users can only read/modify their own channels. Each tool lives in its own file under `src/app/api/mcp/tools/` and is registered in `src/app/api/mcp/registry.ts`.

**Channel tools**

| Tool | Parameters | Returns |
|---|---|---|
| `list_channels` | — | Array of owned channels: `id`, `name`, `slug`, `path`, `description`, `icon`, `parent_id`, `position`, `video_count`. |
| `get_channel` | `id` _or_ `path` (e.g. `"business/startups"`) | One channel + ordered playlist (videos with `id`, `youtube_id`, `title`, `thumbnail_url`, `duration_seconds`, `start_seconds`, `end_seconds`, `position`). |
| `create_channel` | `name` (required); optional `description`, `icon`, `slug`, `parent_id` _or_ `parent_path` | Creates a new owned channel. Slug derived from the name if omitted. Parent can be specified by uuid or URL path — mutually exclusive. |
| `update_channel` | `id` (required); optional `name`, `slug`, `description`, `icon`, `parent_id` _or_ `parent_path` | Updates an existing owned channel. Omitted fields unchanged. `parent_id: null` or `parent_path: ""` moves to root. Reparenting validated — a channel can't become a descendant of itself (uses `descendantIds` from `channel-paths.ts`). |
| `delete_channel` | `id` (required); optional `force` (boolean) | Deletes an owned channel and its videos. Rejected if the channel has sub-channels unless `force: true` — in which case sub-channels are promoted to root via `ON DELETE SET NULL`. |
| `search_channels` | `query` | Fuzzy search over owned channels by name/slug/description. |

**Video tools**

| Tool | Parameters | Returns |
|---|---|---|
| `add_video` | `channel_id`, `url` | Appends one YouTube video to the channel. Title/duration/thumbnail fetched via the Data API. |
| `add_videos_bulk` | `channel_id`, `urls[]` (≤100) | Bulk append. Metadata batched 50/call. Returns `added`, `skipped_duplicates`, `failed` per item. Use instead of looping `add_video`. |
| `import_youtube_playlist` | `channel_id`, `playlist_url`; optional `max_videos` (default 50, cap 200) | Import a YouTube playlist. Dedupes by `youtube_id`; skips live/upcoming streams. |
| `import_youtube_channel` | `channel_id`, `channel_input` (`@handle`, `UC...`, or URL); optional `max_videos` | Import a YouTube channel's uploads feed (uploads playlist trick: `UU` + channel id tail). |
| `list_videos` | `channel_id` | Ordered playlist for a channel. |
| `delete_video` | `video_id` | Remove one video. Ownership checked via the video's channel. |
| `delete_videos_bulk` | `channel_id`; `video_ids[]` _or_ `all: true` | Bulk delete, mirror of `add_videos_bulk`. Scoped by `channel_id` so a spoofed `video_ids` list can't touch other channels. `all: true` wipes the entire playlist (use when a bad import needs undoing). Exactly one of `video_ids` / `all` required. |
| `update_video` | `video_id`; optional `title`, `start_seconds`, `end_seconds` | Edit a single video's metadata or trim points. |
| `refresh_video_metadata` | `video_id` _or_ `channel_id` | Re-fetch title + duration + thumbnail from the Data API. Channel-wide refreshes batch 50/call. Videos YouTube no longer returns land in `failed` but are NOT auto-deleted. |
| `reorder_videos` | `channel_id`, `ordered_video_ids[]` | Set playlist order. Unmentioned videos are appended at the end in their current order. |
| `search_videos` | `query` | Fuzzy search over owned videos by title. |
| `search_youtube` | `query`; optional `max_results` (default 10, cap 50), `min_length_seconds` | Read-only YouTube discovery. Results pipe into `add_video`/`add_videos_bulk`. Uses HTML scraping (not the Data API) because `search.list` costs 100 quota units/call. |

All mutations call `requireOwnership(service, userId, channelId)` which does a `channels.eq("id", …).eq("owner_id", …)` lookup — redundant with the RLS-protected admin paths but explicit here since MCP uses the service client for token lookup.

#### YouTube metadata source

All video-write tools (add / bulk / import / refresh) fetch metadata via the **YouTube Data API v3** (`src/lib/youtube-api.ts`). This replaces the older HTML-scraping path that was vulnerable to YouTube's EU consent wall from Vercel datacenter IPs. `search_youtube` deliberately stays on the scraper because `search.list` is 100 quota units/call; the render-time availability filter stays on oEmbed because it's free and not consent-walled. Requires `YOUTUBE_API_KEY` in env. See [YouTube Metadata](youtube-metadata.md) for the full breakdown.

`duration_seconds` is **load-bearing**: the broadcast schedule in `src/lib/schedule.ts` computes the live edge by summing playlist durations. A zero or missing duration silently corrupts `whatsOnNow()` for the whole channel. Every write path rejects `isLive || durationSeconds <= 0`.

## Connecting Claude to the server

### Claude.ai (web) or Claude Desktop — Custom Connector

1. Open **Settings → Connectors → Add custom connector**.
2. Paste the MCP URL:
   - Prod: `https://frogo.tv/api/mcp`
   - Preview: `https://preview.frogo.tv/api/mcp`
3. Claude hits the URL, gets the `401 + WWW-Authenticate` response, reads the protected-resource metadata at `/.well-known/oauth-protected-resource`, discovers the authorization server at `/.well-known/oauth-authorization-server`, and auto-runs Dynamic Client Registration against `/api/oauth/register`.
4. A browser window opens to `/api/oauth/authorize`. Frogo bounces you to Supabase Google signin, then to `/api/oauth/consent`. Click **Authorize**.
5. Browser redirects back into Claude with the auth code. Claude exchanges it for an access token at `/api/oauth/token` and stores it.
6. Claude's tool list now shows the channel + video tools listed above (`list_channels`, `get_channel`, `create_channel`, `update_channel`, `delete_channel`, `search_channels`, `add_video`, `add_videos_bulk`, `import_youtube_playlist`, `import_youtube_channel`, `list_videos`, `delete_video`, `delete_videos_bulk`, `update_video`, `refresh_video_metadata`, `reorder_videos`, `search_videos`, `search_youtube`).

Try: _"List my Frogo channels"_, _"Create a channel called Test under business"_, _"Import https://youtube.com/playlist?list=PL... into Jazz"_, _"Refresh metadata on the Philosophy channel"_, _"Delete all videos in the Test channel"_.

### Claude Code (CLI)

```bash
claude mcp add --transport http frogo https://preview.frogo.tv/api/mcp
```

The first tool call triggers the OAuth flow in your browser. Tokens are stored per-project.

### Token lifecycle

- Access tokens last **30 days**, stored as SHA-256 hashes in `mcp_access_tokens`.
- Manually revoke a user's tokens with SQL: `UPDATE mcp_access_tokens SET revoked_at = now() WHERE user_id = '<uuid>'`.
- After revocation Claude's next call gets `401 + WWW-Authenticate` and the client re-runs the flow automatically.
