-- TEMPO migration 121: make own-demo follows show a real name on Social.
--
-- Migration 120 linked owners to their demo, but some demo profiles never got
-- a handle (claim races) or drifted from artists.user_id on owner_user_id.
-- Follows then rendered as "Unknown profile" because the list only linked when
-- a handle was present, and private rows with the wrong owner were invisible
-- to the embed join.

-- Point every demo profile at the artist owner account.
update artist_profiles p
set owner_user_id = a.user_id
from artists a
where p.artist_id = a.id
  and a.demo_kind is not null
  and a.user_id is not null
  and p.owner_user_id is distinct from a.user_id;

-- Give handle-less demo profiles a stable unique @name so Follows can link.
update artist_profiles p
set handle = 'president-' || substr(replace(p.id::text, '-', ''), 1, 8)
from artists a
where p.artist_id = a.id
  and a.demo_kind is not null
  and p.handle is null
  and not exists (
    select 1 from artist_profiles other
    where other.handle = 'president-' || substr(replace(p.id::text, '-', ''), 1, 8)
  );

insert into schema_migrations (version, name, checksum, applied_by)
values (121, '121_demo_profile_handle_and_owner', 'initial', 'migration-self-register')
on conflict (version) do nothing;
