-- TEMPO migration 010 — workspace layout preferences (Prompt 11)

create table if not exists user_track_workspace_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,
  stage_id uuid references stages(id) on delete cascade,
  preset text not null check (preset in (
    'writing','production','feedback','mix_review','release_prep','custom'
  )),
  module_order text[] not null default '{}',
  hidden_modules text[] not null default '{}',
  default_panel text,
  compact_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint workspace_prefs_scope check (
    not (track_id is not null and stage_id is not null)
  )
);

-- Precedence scopes: track-specific, stage-specific, or global (both null)
create unique index if not exists idx_workspace_prefs_track
  on user_track_workspace_preferences (user_id, track_id)
  where track_id is not null;

create unique index if not exists idx_workspace_prefs_stage
  on user_track_workspace_preferences (user_id, stage_id)
  where stage_id is not null;

create unique index if not exists idx_workspace_prefs_global
  on user_track_workspace_preferences (user_id)
  where track_id is null and stage_id is null;

alter table user_track_workspace_preferences enable row level security;

drop policy if exists own_workspace_prefs on user_track_workspace_preferences;
create policy own_workspace_prefs on user_track_workspace_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
