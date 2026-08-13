-- TEMPO migration 092 — personal workspaces + teammate visibility
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- Team members currently land inside the artist's catalog because
-- ensureArtists() only seeds an owned row when *no* artist is visible, and
-- membership already makes the managed artist visible. This migration:
--   1. Marks owned rows as music (`artist`) vs the member's own home (`personal`)
--   2. Lets active teammates see each other (roster fan, name/photo) without
--      exposing pending invites or token hashes
--   3. Lets a member with a calendar grant list that artist's spaces (calendar
--      is space-scoped; catalog-only space SELECT left tour managers stuck)
--   4. Exposes public "hats" (Artist / Manager for X) for the Social people
--      surface — names and roles only, never grants or invite emails
--
-- Run in the Supabase SQL editor after 091, on a non-production project first.

-- ---------------------------------------------------------------------------
-- artists.workspace_kind
-- ---------------------------------------------------------------------------
alter table artists
  add column if not exists workspace_kind text not null default 'artist';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'artists_workspace_kind_check'
  ) then
    alter table artists
      add constraint artists_workspace_kind_check
      check (workspace_kind in ('artist', 'personal'));
  end if;
end $$;

create index if not exists idx_artists_user_kind
  on artists (user_id, workspace_kind);

-- ---------------------------------------------------------------------------
-- Teammate visibility — SECURITY DEFINER so RLS never self-references
-- ---------------------------------------------------------------------------
create or replace function is_active_teammate_of(p_artist_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artist_members m
    where m.artist_id = p_artist_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function shares_active_artist_with(p_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artist_members mine
    join artist_members theirs on theirs.artist_id = mine.artist_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = p_user_id
      and theirs.status = 'active'
  );
$$;

grant execute on function is_active_teammate_of(uuid) to authenticated;
grant execute on function shares_active_artist_with(uuid) to authenticated;

-- Active members of the same artist can see other *active* rows (not pending
-- invites, so unused tokens and invite emails stay owner-only).
drop policy if exists teammate_read_active_members on artist_members;
create policy teammate_read_active_members on artist_members for select
  using (
    status = 'active'
    and is_active_teammate_of(artist_id)
  );

drop policy if exists teammate_read_member_profile on artist_member_profiles;
create policy teammate_read_member_profile on artist_member_profiles for select
  using (shares_active_artist_with(user_id));

-- Calendar is space-scoped. A member with calendar (but not catalog) still
-- needs to list the artist's spaces to open the calendar at all.
drop policy if exists member_read_spaces_for_calendar on spaces;
create policy member_read_spaces_for_calendar on spaces for select
  using (can_read_artist_area(artist_id, 'calendar'));

-- ---------------------------------------------------------------------------
-- Social people badges — names and roles of published humans only
-- ---------------------------------------------------------------------------
create or replace function network_person_badges_for(p_user_ids uuid[])
returns jsonb
language sql stable security definer set search_path = public as $$
  with published as (
    select distinct owner_user_id
    from artist_profiles
    where owner_user_id = any (p_user_ids)
      and visibility in ('members', 'public')
  ),
  artist_hat as (
    select distinct on (p.owner_user_id)
           p.owner_user_id as user_id,
           p.handle,
           p.display_name
    from artist_profiles p
    join artists a on a.id = p.artist_id
    where p.owner_user_id = any (p_user_ids)
      and p.visibility in ('members', 'public')
      and coalesce(a.workspace_kind, 'artist') = 'artist'
      and p.handle is not null
    order by p.owner_user_id, p.published_at desc nulls last
  ),
  hats as (
    select m.user_id,
           jsonb_agg(
             jsonb_build_object(
               'role', m.role,
               'artistName', a.name,
               'artistId', a.id
             )
             order by a.name
           ) as hats
    from artist_members m
    join artists a on a.id = m.artist_id
    where m.user_id = any (p_user_ids)
      and m.status = 'active'
      and coalesce(a.workspace_kind, 'artist') = 'artist'
    group by m.user_id
  )
  select coalesce(
    jsonb_object_agg(
      p.owner_user_id::text,
      jsonb_build_object(
        'isArtist', (h.user_id is not null),
        'artistHandle', h.handle,
        'artistName', h.display_name,
        'hats', coalesce(t.hats, '[]'::jsonb)
      )
    ),
    '{}'::jsonb
  )
  from published p
  left join artist_hat h on h.user_id = p.owner_user_id
  left join hats t on t.user_id = p.owner_user_id;
$$;

grant execute on function network_person_badges_for(uuid[]) to authenticated;
