-- TEMPO migration 073 — demo workspace marker
-- Additive only. Run in Supabase SQL Editor. Drops nothing and rewrites nothing.
--
-- The demo lives as a whole extra ARTIST alongside the member's own, so that
-- exploring it can never mix sample data into real music and removing it is a
-- single scoped delete. This column is the only thing that tells the two apart.
--
-- Null = a real artist the member made. Anything else names the sample catalog
-- that artist was seeded from ('president' today), which also lets a future
-- demo replace an older one without guessing from the artist's name.

alter table artists
  add column if not exists demo_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'artists_demo_kind_valid'
  ) then
    alter table artists add constraint artists_demo_kind_valid
      check (demo_kind is null or char_length(demo_kind) between 1 and 40);
  end if;
end $$;

-- Every demo read is "does this account have one, and which artist is it" —
-- a partial index keeps that free without touching the common artist listing.
create index if not exists idx_artists_demo
  on artists (user_id)
  where demo_kind is not null;

comment on column artists.demo_kind is
  'Non-null marks a seeded demo artist (never real member data). Removing the demo deletes this artist and everything hanging off it.';
