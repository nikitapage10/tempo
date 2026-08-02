-- TEMPO migration 043 — Spotify catalog metadata imported with tracks
-- Additive only. Run in Supabase SQL Editor after migration 042.
--
-- Artwork itself is copied into the existing private `audio` bucket and its
-- storage path remains in tracks.artwork_url. These columns keep the catalog
-- provenance and release metadata needed to refresh or unlink it later.

alter table tracks
  add column if not exists spotify_track_id text,
  add column if not exists spotify_url text,
  add column if not exists spotify_album_id text,
  add column if not exists spotify_album_name text,
  add column if not exists spotify_album_url text,
  add column if not exists spotify_release_date text,
  add column if not exists spotify_release_date_precision text,
  add column if not exists spotify_isrc text,
  add column if not exists spotify_duration_ms integer,
  add column if not exists spotify_explicit boolean,
  add column if not exists spotify_track_number integer,
  add column if not exists spotify_disc_number integer,
  add column if not exists spotify_artist_names text[] not null default '{}',
  add column if not exists spotify_synced_at timestamptz;

alter table tracks drop constraint if exists tracks_spotify_release_date_precision_check;
alter table tracks add constraint tracks_spotify_release_date_precision_check
  check (
    spotify_release_date_precision is null
    or spotify_release_date_precision in ('year', 'month', 'day')
  );

alter table tracks drop constraint if exists tracks_spotify_duration_ms_check;
alter table tracks add constraint tracks_spotify_duration_ms_check
  check (spotify_duration_ms is null or spotify_duration_ms >= 0);

create index if not exists idx_tracks_spotify_track_id
  on tracks (spotify_track_id)
  where spotify_track_id is not null;

comment on column tracks.spotify_track_id is
  'Spotify catalog track id selected during import; not used as TEMPO identity.';
comment on column tracks.spotify_release_date is
  'Spotify release date kept as text because the API can return YYYY, YYYY-MM, or YYYY-MM-DD.';
comment on column tracks.spotify_synced_at is
  'Last time TEMPO verified and copied this track metadata from Spotify.';
