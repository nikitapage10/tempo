-- TEMPO migration 041 — Tracks-page groups
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Named buckets on the Tracks list (album, EP, playlist, whatever you call them).
-- Independent of projects. Each track belongs to at most one group; deleting a
-- group leaves its tracks ungrouped.

create table if not exists track_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint track_groups_name_len check (
    char_length(trim(name)) >= 1 and char_length(name) <= 60
  )
);

create index if not exists idx_track_groups_space_sort
  on track_groups (space_id, sort);

alter table track_groups enable row level security;

drop policy if exists own_track_groups on track_groups;
create policy own_track_groups on track_groups for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table tracks
  add column if not exists list_group_id uuid references track_groups(id) on delete set null;

create index if not exists idx_tracks_space_list_group
  on tracks (space_id, list_group_id, list_sort);
