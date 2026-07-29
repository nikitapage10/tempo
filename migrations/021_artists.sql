-- TEMPO migration 021 — artists
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Introduces `artists` as a layer above spaces: one account can manage
-- multiple artist aliases (name, logo, banner, accent palette), each owning
-- its own spaces. Existing spaces are backfilled onto one artist per user
-- so nothing already in the catalog moves or changes look.

create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  logo_url text,
  banner_url text,
  banner_color text,
  palette_id text not null default 'spectra',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint artists_name_len check (
    char_length(trim(name)) >= 1 and char_length(name) <= 60
  )
);

create index if not exists idx_artists_user on artists (user_id, sort);

alter table artists enable row level security;

drop policy if exists own_artists on artists;
create policy own_artists on artists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nullable first so the backfill below can run before the not-null lands.
alter table spaces add column if not exists artist_id uuid references artists(id) on delete cascade;

-- One artist per existing user who has spaces, named after their
-- first space (by sort) so it reads as something real. Every one of that
-- user's spaces attaches to it.
do $$
declare
  u record;
  new_artist_id uuid;
  first_space_name text;
begin
  for u in select distinct user_id from spaces where artist_id is null loop
    select name into first_space_name from spaces
      where user_id = u.user_id order by sort asc limit 1;

    -- spaces.name is unbounded but artists.name caps at 60, so clamp it.
    insert into artists (user_id, name, sort)
    values (
      u.user_id,
      coalesce(nullif(left(trim(first_space_name), 60), ''), 'My Artist'),
      0
    )
    returning id into new_artist_id;

    update spaces set artist_id = new_artist_id
      where user_id = u.user_id and artist_id is null;
  end loop;
end $$;

alter table spaces alter column artist_id set not null;
create index if not exists idx_spaces_artist on spaces (artist_id, sort);
