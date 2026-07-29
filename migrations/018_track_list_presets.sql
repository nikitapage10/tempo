-- TEMPO migration 018 — named Tracks list orders
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Lets you save the current Custom track order under a name and pick it later
-- from the Tracks sort row. Depends on migration 017 (list_sort) for the live
-- Custom order you rearrange day to day.

create table if not exists track_list_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null,
  track_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint track_list_presets_name_len check (
    char_length(trim(name)) >= 1 and char_length(name) <= 60
  )
);

create index if not exists idx_track_list_presets_space
  on track_list_presets (space_id, created_at);

alter table track_list_presets enable row level security;

drop policy if exists own_track_list_presets on track_list_presets;
create policy own_track_list_presets on track_list_presets for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
