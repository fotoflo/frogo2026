-- MCP OAuth 2.1 tables — let third-party Claude clients authenticate users
-- against Frogo via a standard OAuth flow (DCR + PKCE + authorization code)
-- backed by Supabase's existing Google provider.
--
-- Four tables:
--   mcp_clients        — dynamically registered OAuth clients (public, no secret)
--   mcp_auth_sessions  — in-flight authorize requests waiting for Google signin
--   mcp_auth_codes     — short-lived authorization codes bound to a user + PKCE
--   mcp_access_tokens  — bearer tokens returned to MCP clients (stored as hash)
--
-- All tables are service-role-only. No public RLS policies — callers go
-- through the OAuth routes which run with the service client.

create table if not exists mcp_clients (
  client_id       text primary key,
  client_name     text not null,
  redirect_uris   text[] not null,
  created_at      timestamptz not null default now()
);

-- Pending authorize requests: created at /api/oauth/authorize, consumed at
-- /api/oauth/consent after the user completes Google signin. Short-lived
-- (10 minutes). Keyed by a random session_id that we stash in a cookie so
-- the consent page can recover the PKCE state.
create table if not exists mcp_auth_sessions (
  session_id            text primary key,
  client_id             text not null references mcp_clients(client_id) on delete cascade,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null,
  state                 text,
  scope                 text not null default 'frogo:curate',
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now()
);

create index if not exists mcp_auth_sessions_expires_at_idx on mcp_auth_sessions (expires_at);

create table if not exists mcp_auth_codes (
  code                  text primary key,
  client_id             text not null references mcp_clients(client_id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null,
  scope                 text not null default 'frogo:curate',
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now()
);

create index if not exists mcp_auth_codes_user_id_idx on mcp_auth_codes (user_id);
create index if not exists mcp_auth_codes_expires_at_idx on mcp_auth_codes (expires_at);

create table if not exists mcp_access_tokens (
  token_hash     text primary key,
  client_id      text not null references mcp_clients(client_id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  scope          text not null default 'frogo:curate',
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists mcp_access_tokens_user_id_idx on mcp_access_tokens (user_id);
create index if not exists mcp_access_tokens_expires_at_idx on mcp_access_tokens (expires_at);

-- Lock everything down — service role only.
alter table mcp_clients        enable row level security;
alter table mcp_auth_sessions  enable row level security;
alter table mcp_auth_codes     enable row level security;
alter table mcp_access_tokens  enable row level security;
