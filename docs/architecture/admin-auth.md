# Admin Auth & God Mode

Admin pages under `/admin` are gated behind Google OAuth via Supabase Auth. A `profiles` table layered on top of `auth.users` adds a per-user `role` and `god_mode` flag. God mode is an ownership bypass: it lets a single operator (fotoflo@gmail.com) see and edit every channel regardless of `owner_id`.

## Key Files

- `src/app/login/page.tsx` — sign-in screen, single "Continue with Google" button that forwards to `/api/auth/signin?next=...`
- `src/app/api/auth/signin/route.ts` — calls `supabase.auth.signInWithOAuth` and redirects to Google
- `src/app/api/auth/callback/route.ts` — exchanges OAuth code for a session cookie, bumps login stats, runs the god_mode ownership claim
- `src/app/api/auth/signout/route.ts` — clears the session
- `src/lib/admin-auth.ts` — `requireAdmin()` helper; returns `{ supabase, user, profile }` or redirects to `/login`
- `src/app/admin/layout.tsx` — route-group gate; unauthed requests redirect to `/login?next=/admin`
- `src/app/admin/page.tsx`, `src/app/admin/actions.ts` — use `requireAdmin()` and branch on `profile.god_mode`
- `supabase/migrations/20260411000000_profiles.sql` — profiles table, `on_auth_user_created` trigger, fotoflo god_mode seed
- `supabase/migrations/20260411010000_god_mode_write_all.sql` — additive RLS policies that let god_mode users write any row

## Auth Flow

```
┌──────────┐    ┌─────────┐    ┌──────────────┐    ┌──────────┐
│  /login  │───▶│ Google  │───▶│ /api/auth/   │───▶│  /admin  │
│          │    │  OAuth  │    │  callback    │    │          │
└──────────┘    └─────────┘    └──────────────┘    └──────────┘
      │                               │
      │                               ├─ exchangeCodeForSession → sb cookie
      │                               ├─ increment_profile_login RPC
      │                               └─ if god_mode: claim null-owner channels
      │
      └─ ?next=/some/path preserved through the whole flow
```

1. Visitor hits `/admin/*` → `AdminLayout` sees no user, redirects to `/login?next=/admin/...`
2. `/login` renders a Google button pointing at `/api/auth/signin?next=...`
3. `signin` route kicks off `supabase.auth.signInWithOAuth` → Google
4. Google bounces back to `/api/auth/callback?code=...&next=...`
5. Callback exchanges the code for a Supabase session cookie, bumps login stats, runs the god_mode ownership claim if applicable, and redirects to `next`
6. `AdminLayout` now sees a user and renders admin UI; inner server components call `requireAdmin()` for the full `profile` (including `god_mode`)

## Profiles Table

`profiles` mirrors `auth.users` with app-level columns:

- `id uuid PK` — matches `auth.users.id`
- `email text`
- `role text` — `user` | `admin`
- `god_mode boolean` — ownership bypass
- `login_count int`, `last_login_at timestamptz`

### Auto-create trigger

`on_auth_user_created` fires after insert on `auth.users`. It inserts a matching `profiles` row and auto-promotes a hardcoded email (fotoflo@gmail.com) to `god_mode=true, role='admin'`. This means the profile always exists by the time the OAuth callback runs — no race, no upsert needed.

### `increment_profile_login` RPC

Called from the callback. Atomic `UPDATE profiles SET login_count = login_count + 1, last_login_at = now()` so concurrent sign-ins don't lose counts.

## `requireAdmin()` Pattern

Every admin server component and server action starts with:

```ts
const { supabase, user, profile } = await requireAdmin();
// ...
let query = service.from("channels").select("...");
if (!profile.god_mode) {
  query = query.eq("owner_id", user.id);
}
```

`requireAdmin()` redirects to `/login?next=/admin` if there's no session. The profile lookup uses the **service client** (not the request-scoped client) to bypass the `profiles_self_select` RLS policy — this ensures the page can't be tricked into mis-reporting `god_mode` by a forged client-side cookie.

Default profile when row is missing: `{ role: "user", god_mode: false }` — fail-closed.

## God Mode

God mode is the per-user ownership bypass, layered in two places:

### 1. RLS policies (Postgres)

The base channel policies scope writes to `owner_id = auth.uid()`. `20260411010000_god_mode_write_all.sql` adds **additive** `god_mode_*` policies (`FOR ALL USING (profiles.god_mode)`) on `channels`, `videos`, and related tables. Additive means: a god_mode user passes either the base owner check OR the god_mode check, so deletions and updates on rows they don't own still succeed.

### 2. Application queries

Server components that list "my channels" cannot rely on RLS alone — they need to actively show all channels when in god mode. Every admin list query checks `profile.god_mode` and conditionally omits the `owner_id` filter (see `src/app/admin/page.tsx`).

### Ownership claim on sign-in

When a god_mode user signs in, the callback does:

```ts
await service.from("channels").update({ owner_id: user.id }).is("owner_id", null);
```

Idempotent — only updates rows with `owner_id IS NULL`. After the first god_mode sign-in, legacy channels are owned and the update is a no-op.

## Gotcha: PostgREST Embed Disambiguation

The `channels` and `videos` tables have **two** foreign key relationships between them:

- `videos.channel_id → channels.id` (the normal parent/child)
- `channels.og_first_video_id → videos.id` (for OG image generation)

PostgREST cannot pick which one to use in an embed, and throws `PGRST201` ("Could not embed because more than one relationship was found"). Any embed query from `channels` into `videos` MUST name the FK explicitly:

```ts
// WRONG — ambiguous, throws PGRST201
supabase.from("channels").select("id, name, videos(count)");

// RIGHT — disambiguates via the constraint name
supabase.from("channels").select("id, name, videos!videos_channel_id_fkey(count)");
```

Affected call sites: `src/app/admin/page.tsx`, `src/app/mobile/page.tsx`. Check any new code that embeds videos under channels.

## Environment

Requires Supabase Auth to have a Google provider configured in the project dashboard with a callback URL of `https://<host>/api/auth/callback` (plus the ngrok URL during dev, if you want OAuth to work over the tunnel).
