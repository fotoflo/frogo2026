-- Channel hierarchy: channels can now have a parent_id, forming a tree.
-- URL paths are derived by walking parent → root. Slug only needs to be
-- unique per parent, so `business/startups` and `tech/startups` can both
-- exist.
--
-- Breaking change: the global uniqueness constraint on channels.slug is
-- replaced with a composite unique on (parent_id, slug). Nulls in unique
-- constraints: Postgres treats each null as distinct, so two top-level
-- channels could technically share a slug. We add a partial unique index
-- on slug where parent_id is null to cover that case.

alter table channels
  add column if not exists parent_id uuid references channels(id) on delete set null;

create index if not exists channels_parent_id_idx on channels (parent_id);

-- Drop the old global unique constraint on slug (if it exists).
-- Supabase/Postgres auto-names it channels_slug_key when created via `unique`.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'channels_slug_key' and conrelid = 'channels'::regclass
  ) then
    alter table channels drop constraint channels_slug_key;
  end if;
end $$;

-- Sibling uniqueness: (parent_id, slug) must be unique. Because parent_id
-- can be null, we need two separate constraints: one for rows with a parent
-- and one for top-level rows.
create unique index if not exists channels_slug_parent_unique
  on channels (parent_id, slug)
  where parent_id is not null;

create unique index if not exists channels_slug_root_unique
  on channels (slug)
  where parent_id is null;
