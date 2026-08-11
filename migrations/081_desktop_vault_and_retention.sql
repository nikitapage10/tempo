-- TEMPO migration 081 — desktop local vault + cloud retention rework
-- (TEMPO Desktop Packages 2-3, see planning/desktop/02-TECHNICAL-AND-DATA-DESIGN.md §4-5).
-- Additive only. Depends on migration 080 (user_devices).
--
-- Today, pruning (application code in lib/version-prune.ts) deletes a
-- version's row and its storage object together once it falls outside the
-- pinned+2-newest window. Desktop retention needs a version row to outlive
-- its cloud object (bounce is local-only, evicted from the cloud, still
-- fully present in the artist's history), so version rows are no longer
-- deleted by the automatic prune process at all (manual delete from the
-- track page is unaffected) — only the storage object is removed.
--
-- file_url deliberately STAYS non-null and is never cleared on eviction: it
-- is also the desktop vault's lookup key (the local vault mirrors the exact
-- same tracks/{trackId}/versions/{versionId}/{filename} path convention), so
-- clearing it on eviction would destroy the very key a device needs to find
-- its local copy. cloud_state alone says whether that path currently
-- resolves in the bucket; file_url is the permanent, immutable identity of
-- the bounce whether or not the cloud object still exists.

alter table versions
  add column if not exists cloud_state text not null default 'in_cloud'
    check (cloud_state in ('in_cloud', 'local_only')),
  add column if not exists evicted_at timestamptz;

comment on column versions.file_url is
  'Storage path (also the desktop vault''s lookup key), not a public URL. Stays set even after cloud eviction — see cloud_state.';
comment on column versions.cloud_state is
  'in_cloud: file_url currently resolves in the audio bucket. local_only: the cloud object was evicted after a confirmed device copy existed (see version_local_copies); the bounce lives on in the artist''s desktop vault(s), still at the same file_url path.';

-- One row per (version, device) that has confirmed a local copy on disk.
-- This is the enforcement mechanism for cloud eviction: a version is only
-- ever evicted once at least one row exists here for it, so an artist with
-- no desktop app never silently loses a bounce. Also what powers the
-- "on another computer" version-history badge.
create table if not exists version_local_copies (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references versions(id) on delete cascade,
  device_id uuid not null references user_devices(id) on delete cascade,
  checksum text not null,
  confirmed_at timestamptz not null default now(),
  unique (version_id, device_id)
);

create index if not exists idx_version_local_copies_version on version_local_copies (version_id);
create index if not exists idx_version_local_copies_device on version_local_copies (device_id);

alter table version_local_copies enable row level security;

-- Collaborator-aware, following the existing versions policies in
-- migrations/009_track_collaboration.sql. Recording that a local mirror
-- exists is bookkeeping about a read, not an upload — so insert follows
-- can_read_track (any collaborator who can hear a bounce can register having
-- mirrored it), not can_upload_track. That matters for the retention safety
-- guarantee too: a viewer's mirror should count just as much as an owner's
-- toward "a confirmed local copy exists somewhere."
create policy "version_local_copies_select" on version_local_copies
  for select using (
    exists (
      select 1 from versions v
      where v.id = version_local_copies.version_id
        and can_read_track(v.track_id)
    )
  );

create policy "version_local_copies_insert" on version_local_copies
  for insert with check (
    exists (
      select 1 from versions v
      where v.id = version_local_copies.version_id
        and can_read_track(v.track_id)
    )
    and exists (
      select 1 from user_devices d
      where d.id = version_local_copies.device_id
        and d.user_id = auth.uid()
    )
  );

create policy "version_local_copies_delete" on version_local_copies
  for delete using (
    exists (
      select 1 from user_devices d
      where d.id = version_local_copies.device_id
        and d.user_id = auth.uid()
    )
  );
