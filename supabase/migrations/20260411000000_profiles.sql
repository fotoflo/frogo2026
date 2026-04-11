-- User profiles — one row per auth.users row, keyed by the same UUID.
-- Holds app-level metadata we don't want to cram into auth.users metadata:
-- role, god_mode (all-powerful admin flag), login counters, timestamps.
--
-- Auto-created on signup via a trigger on auth.users. fotoflo@gmail.com
-- is auto-promoted to admin + god_mode at signup time.

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'user' check (role in ('user', 'admin')),
  god_mode    boolean not null default false,
  logins      integer not null default 0,
  last_login  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on profiles (email);
create index if not exists profiles_god_mode_idx on profiles (god_mode) where god_mode;

alter table profiles enable row level security;

-- Users can read their own profile. God-mode users can read any profile.
drop policy if exists "profiles_self_select" on profiles;
create policy "profiles_self_select" on profiles
  for select
  using (id = auth.uid());

drop policy if exists "profiles_god_select" on profiles;
create policy "profiles_god_select" on profiles
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.god_mode
    )
  );

-- No client-side writes — the auth callback + triggers manage everything
-- via the service role, which bypasses RLS.

-- Auto-create a profile row whenever a new auth.users row appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, god_mode)
  values (
    new.id,
    new.email,
    case when new.email = 'fotoflo@gmail.com' then 'admin' else 'user' end,
    new.email = 'fotoflo@gmail.com'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called by the auth callback on every successful sign-in. Atomic bump so
-- concurrent sign-ins (rare but possible across devices) don't clobber.
create or replace function public.increment_profile_login(profile_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set logins = logins + 1,
      last_login = now()
  where id = profile_id;
$$;

grant execute on function public.increment_profile_login(uuid) to service_role;
grant execute on function public.increment_profile_login(uuid) to authenticated;

