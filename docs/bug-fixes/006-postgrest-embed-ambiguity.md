# Bug Fix 006: PostgREST Embed Ambiguity After Supabase Migration

**Date:** 2026-04-11
**Severity:** High — admin and mobile channel lists were completely empty on the new Supabase project
**Status:** Fixed

---

## Symptom

After migrating to a new Supabase project, `fotoflo@gmail.com` (a `god_mode` admin) logged into `/admin` and saw:

> "You don't own any channels yet"

Direct SQL confirmed the opposite: fotoflo had `god_mode = true` and owned all 12 channels in the database. The same bug existed on `/mobile` (it would have hit any visitor browsing channels) and was caught during code review of the fix.

The old shared Supabase project worked fine. Only the freshly migrated project exhibited the bug.

---

## Root Cause

The admin channel list query used PostgREST's implicit embed syntax to count videos per channel:

```ts
// src/app/admin/page.tsx — before
const query = supabase
  .from("channels")
  .select("id, name, slug, owner_id, ..., videos(count)");
```

This worked on the old Supabase project because there was exactly **one** foreign key between `channels` and `videos`:

1. `videos.channel_id → channels.id` — the real channel→videos relationship.

On the new project, migration `20260408210000_add_og_image_cache.sql` added a second foreign key in the opposite direction to cache the OG image's source video:

2. `channels.og_first_video_id → videos.id`

With two FKs between the same pair of tables, PostgREST cannot decide which relationship to embed and returns:

> Could not embed because more than one relationship was found for 'channels' and 'videos'

The query failed with an error, but the page code destructured only `data`:

```ts
const { data: channels } = await query.order("created_at", { ascending: false });
```

The error was silently discarded, `channels` came back as `null`, and the page rendered the "no channels" empty state for an admin who owned everything.

---

## Why It Was Hard to Find

1. **The DB state was correct.** Direct SQL queries confirmed `god_mode = true` and 12 owned channels. Nothing looked wrong at the data layer.
2. **The error was swallowed.** Because the call only pulled `data` out of the supabase result, the PostgREST embed error never surfaced in logs or the UI — it just looked like an empty list.
3. **The symptom mimicked an auth bug.** An empty channel list for an admin looked like a `god_mode` / RLS / JWT problem. Time was spent auditing RLS policies, cookie state, dev server env vars, and stale sessions before diagnostic logging pointed at the query itself.
4. **It only reproduced on the new project.** The old shared Supabase project didn't yet have the `og_image_url` / `og_first_video_id` columns, so the embed was unambiguous there. The bug only appeared after every migration was applied on the new project — a classic "works on staging, broken on prod" fresh-environment trap.

---

## The Fix

Disambiguate the embed by naming the foreign key explicitly:

### `src/app/admin/page.tsx`

```ts
// Before
.select("id, name, slug, owner_id, ..., videos(count)")

// After
.select("id, name, slug, owner_id, ..., videos!videos_channel_id_fkey(count)")
```

### `src/app/mobile/page.tsx`

```ts
// Before
.select("id, name, slug, ..., videos(count)")

// After
.select("id, name, slug, ..., videos!videos_channel_id_fkey(count)")
```

By naming `videos_channel_id_fkey`, PostgREST knows to traverse the real channel→videos relationship and ignore the OG image cache FK.

---

## Key Rule

**When a table has multiple foreign keys to another table, PostgREST embed syntax MUST name the FK explicitly (`target!fk_name(...)`).** Implicit embeds only work while there's exactly one relationship — the moment a second FK is added (even an unrelated one like an OG image cache pointer), every implicit embed across both tables silently breaks.

**And always destructure `error` from Supabase query results and at least log it.** Silent failures look identical to empty state and send debugging down the wrong path:

```ts
// Bad — errors vanish
const { data: channels } = await query;

// Good — errors are visible
const { data: channels, error } = await query;
if (error) console.error("channel query failed", error);
```

---

## Files Involved

- `src/app/admin/page.tsx`
- `src/app/mobile/page.tsx`
- `supabase/migrations/20260408210000_add_og_image_cache.sql` — the migration that introduced the second FK (`channels.og_first_video_id → videos.id`)
