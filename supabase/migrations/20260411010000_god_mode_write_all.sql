-- God-mode users can write any channel / video, bypassing owner_id checks.
-- These are additive policies — RLS OR's policies together for a given
-- action, so the existing "Owner insert/update/delete" policies still let
-- regular authed users manage their own rows.

create or replace function public.is_god_mode()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select god_mode from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_god_mode() to authenticated;
grant execute on function public.is_god_mode() to service_role;

-- Channels
drop policy if exists "God insert channels" on channels;
create policy "God insert channels"
  on channels for insert
  to authenticated
  with check (public.is_god_mode());

drop policy if exists "God update channels" on channels;
create policy "God update channels"
  on channels for update
  to authenticated
  using (public.is_god_mode())
  with check (public.is_god_mode());

drop policy if exists "God delete channels" on channels;
create policy "God delete channels"
  on channels for delete
  to authenticated
  using (public.is_god_mode());

-- Videos
drop policy if exists "God insert videos" on videos;
create policy "God insert videos"
  on videos for insert
  to authenticated
  with check (public.is_god_mode());

drop policy if exists "God update videos" on videos;
create policy "God update videos"
  on videos for update
  to authenticated
  using (public.is_god_mode())
  with check (public.is_god_mode());

drop policy if exists "God delete videos" on videos;
create policy "God delete videos"
  on videos for delete
  to authenticated
  using (public.is_god_mode());
