-- TEMPO migration 024 — platform links and daily stat snapshots
-- Additive only. Run in Supabase SQL Editor. Drops nothing, rewrites nothing.
--
-- Two pieces:
--   1. Which profile on each platform belongs to which TEMPO artist.
--   2. A daily snapshot of the public counters those platforms expose.
--
-- Why snapshots: Spotify and SoundCloud both return *today's* cumulative
-- numbers — followers, plays, likes — and no history at all. Storing one row
-- per artist per platform per day is what turns those flat numbers into the
-- trend line the Artist page draws. Nothing here is derived or estimated; each
-- row is exactly what the platform returned at `captured_at`.

-- ---------- 1. links ----------

alter table artists
  add column if not exists spotify_artist_id text,
  add column if not exists soundcloud_user_id text,
  add column if not exists apple_artist_id text;

comment on column artists.spotify_artist_id is
  'Spotify artist ID (the 22-char base62 id from open.spotify.com/artist/<id>). Null = not linked.';
comment on column artists.soundcloud_user_id is
  'SoundCloud numeric user id for this artist. Null = not linked.';
comment on column artists.apple_artist_id is
  'iTunes/Apple Music artist id, used for the free catalog lookup. Null = not linked.';

-- ---------- 2. snapshots ----------

create table if not exists platform_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  platform text not null check (platform in ('spotify', 'soundcloud')),

  -- The local date the snapshot represents, so "one per day" is enforceable
  -- regardless of what time the job actually ran.
  captured_on date not null default current_date,
  captured_at timestamptz not null default now(),

  -- Followers exist on both platforms. The rest are platform-specific and
  -- stay null where they don't apply, rather than being faked as zero.
  followers int,
  -- Spotify only: 0-100, Spotify's own relative measure. Not a stream count.
  popularity int,
  -- SoundCloud only: summed across the artist's public tracks.
  plays bigint,
  likes bigint,
  reposts bigint,
  track_count int,

  -- Raw per-track counters, so a later feature can break the totals down
  -- without needing a new migration or a re-fetch of history.
  detail jsonb,

  created_at timestamptz not null default now(),

  -- One snapshot per artist per platform per day; the job upserts onto this.
  unique (artist_id, platform, captured_on)
);

create index if not exists idx_platform_snapshots_artist
  on platform_snapshots (artist_id, platform, captured_on desc);

alter table platform_snapshots enable row level security;

drop policy if exists own_platform_snapshots on platform_snapshots;
create policy own_platform_snapshots on platform_snapshots for all
  using (
    exists (
      select 1 from artists a
      where a.id = artist_id and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from artists a
      where a.id = artist_id and a.user_id = auth.uid()
    )
  );
