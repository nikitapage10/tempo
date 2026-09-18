-- TEMPO migration 122: let you read profiles for artists you own.
--
-- Follow embeds were returning null for some private demo profiles even after
-- 120/121, so Social showed "Profile unavailable". owner_user_id can drift from
-- artists.user_id; this policy uses a security-definer check on the artist row
-- (bypassing artists RLS) so an owned demo is always readable by its owner.
-- Also repairs demo display names / handles / owners one more time.

create or replace function owns_artist_of_profile(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from artist_profiles p
    join artists a on a.id = p.artist_id
    where p.id = p_profile_id
      and a.user_id = auth.uid()
  );
$$;

revoke execute on function owns_artist_of_profile(uuid) from public, anon;
grant execute on function owns_artist_of_profile(uuid) to authenticated;

drop policy if exists read_artist_profiles on artist_profiles;
create policy read_artist_profiles on artist_profiles for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or owns_artist_of_profile(id)
    or visibility in ('members', 'public')
  );

-- Repair demo identity rows so Follows has a name and @handle to show.
update artist_profiles p
set
  owner_user_id = coalesce(a.user_id, p.owner_user_id),
  display_name = coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(a.name), ''), 'PRESIDENT'),
  handle = coalesce(
    p.handle,
    'president-' || substr(replace(p.id::text, '-', ''), 1, 8)
  )
from artists a
where p.artist_id = a.id
  and a.demo_kind is not null
  and a.user_id is not null
  and (
    p.owner_user_id is distinct from a.user_id
    or p.handle is null
    or nullif(btrim(p.display_name), '') is null
  );

insert into schema_migrations (version, name, checksum, applied_by)
values (122, '122_read_own_artist_profiles', 'initial', 'migration-self-register')
on conflict (version) do nothing;
