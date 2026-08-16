-- TEMPO migration 098: first-class professional profiles.
-- Additive and rerunnable. Run after 097.
--
-- Artist and Pro identities share handles, visibility, messaging, and the
-- social graph, but their public language is different. Keep that distinction
-- on the self-contained profile row so public/social reads never need to join
-- the private artists table.

alter table artist_profiles
  add column if not exists profile_kind text not null default 'artist';

alter table artist_profiles
  drop constraint if exists artist_profiles_profile_kind_check;
alter table artist_profiles
  add constraint artist_profiles_profile_kind_check
  check (profile_kind in ('artist', 'pro'));

update artist_profiles profile
set profile_kind = case
  when artist.workspace_kind = 'personal' then 'pro'
  else 'artist'
end
from artists artist
where artist.id = profile.artist_id
  and profile.profile_kind is distinct from case
    when artist.workspace_kind = 'personal' then 'pro'
    else 'artist'
  end;

create or replace function sync_artist_profile_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update artist_profiles profile set
    display_name     = new.name,
    emblem_url       = new.emblem_url,
    banner_url       = new.banner_url,
    banner_color     = new.banner_color,
    banner_color_end = new.banner_color_end,
    ice_color        = new.ice_color,
    amber_color      = new.amber_color,
    palette_id       = new.palette_id,
    profile_kind     = case when new.workspace_kind = 'personal' then 'pro' else 'artist' end
  where profile.artist_id = new.id;
  return new;
end;
$$;

insert into schema_migrations (version, name, checksum, applied_by)
values (98, '098_professional_profiles', 'initial', 'migration-self-register')
on conflict (version) do nothing;
