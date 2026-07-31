-- TEMPO migration 032 — "Top 8" quick-access picks on the Social page.
-- Additive only. Run in Supabase SQL Editor. Drops nothing, rewrites nothing.
--
-- A short, owner-curated list of artist_profiles ids (a la the old MySpace
-- Top 8) that the owner wants pinned for quick access on Social. Lives on
-- artist_profiles per the 028 rule: this is public identity data (visible on
-- your published profile eventually, and read to render the picks), not a
-- private setting, so it belongs on the same table as the rest of the
-- public-identity columns rather than on `artists`.
--
-- No RLS changes: artist_profiles' existing select/update policies already
-- cover this column, since it's just one more field on rows already governed
-- by "owner can write, network can read per visibility".

alter table artist_profiles
  add column if not exists top8 uuid[] not null default '{}';

alter table artist_profiles
  drop constraint if exists artist_profiles_top8_len;
alter table artist_profiles
  add constraint artist_profiles_top8_len check (array_length(top8, 1) is null or array_length(top8, 1) <= 8);
