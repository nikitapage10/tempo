-- TEMPO migration 091 — a team member's own display name and avatar
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- artist_members (migration 089) is keyed per (artist, person) and holds
-- sensitive grant data — role, areas, invite token hash. A team member's own
-- identity (their name, their photo) is a property of the *person*, not of
-- any one membership, and shouldn't sit on a row an artist owner can freely
-- rewrite. This is a separate, small, user-owned table instead: one row per
-- person, editable only by that person, readable by any artist owner they
-- actively work with (so the team page can show a real name and photo, not
-- just an email address).

create table if not exists artist_member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now(),

  constraint artist_member_profiles_name_length
    check (display_name is null or char_length(display_name) between 1 and 80)
);

alter table artist_member_profiles enable row level security;

drop policy if exists own_artist_member_profile on artist_member_profiles;
create policy own_artist_member_profile on artist_member_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- An artist owner can see the name/photo of anyone actively on their team —
-- read-only, and only for people they currently work with (a revoked
-- membership drops this visibility along with everything else).
drop policy if exists artist_owner_read_member_profile on artist_member_profiles;
create policy artist_owner_read_member_profile on artist_member_profiles for select
  using (
    exists (
      select 1 from artist_members m
      join artists a on a.id = m.artist_id
      where m.user_id = artist_member_profiles.user_id
        and m.status = 'active'
        and a.user_id = auth.uid()
    )
  );

create or replace function set_artist_member_profile_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_artist_member_profile_updated_at on artist_member_profiles;
create trigger trg_artist_member_profile_updated_at
  before update on artist_member_profiles
  for each row execute function set_artist_member_profile_updated_at();
