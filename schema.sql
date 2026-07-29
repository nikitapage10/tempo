-- TEMPO schema v1 — paste into Supabase SQL Editor and Run.
-- Matches tempo-design-spec.md §4.

create extension if not exists "pgcrypto";

-- ---------- Core containers ----------

create table artists ( -- migration 021
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

create table spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade, -- migration 021
  name text not null,
  sort int not null default 0,
  accent_color text,
  focus text not null default 'music' check (focus in ('music', 'tasks')), -- migration 019
  created_at timestamptz not null default now()
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  color text,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references spaces(id) on delete set null,
  name text not null,
  description text,
  deadline date,
  status text not null default 'active' check (status in ('active','done','parked')),
  created_at timestamptz not null default now()
);

-- ---------- Tracks ----------

create table tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  stage_id uuid references stages(id) on delete set null,
  title text not null,
  artist_alias text,
  type text not null default 'original'
    check (type in ('original','remix','edit','collab','bootleg')),
  bpm numeric(5,1),
  musical_key text,
  genre text,
  destination text,
  deadline date,
  momentum text not null default 'active'
    check (momentum in ('active','simmering','stalled','parked')),
  tags text[] not null default '{}',
  notes text,
  artwork_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table versions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  version_no int not null,
  label text,
  changelog text,
  file_url text not null,           -- storage path, not a public URL
  file_size bigint,
  duration numeric(7,2),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (track_id, version_no)
);

-- Auto-number versions per track
create or replace function set_version_no() returns trigger as $$
begin
  select coalesce(max(version_no), 0) + 1 into new.version_no
  from versions where track_id = new.track_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_version_no before insert on versions
for each row execute function set_version_no();

-- Only one current version per track
create or replace function set_current_version() returns trigger as $$
begin
  if new.is_current then
    update versions set is_current = false
    where track_id = new.track_id and id <> new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_current_version after insert or update of is_current on versions
for each row execute function set_current_version();

create table assets (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('stem','midi','artwork','lyrics','reference','other')),
  name text not null,
  file_url text not null,
  file_size bigint,
  created_at timestamptz not null default now()
);

-- ---------- Checklists, tasks, sessions ----------

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]',   -- [{"text": "...", "sort": 0}]
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id uuid references tracks(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  space_id uuid references spaces(id) on delete cascade, -- migration 019
  title text not null,
  category text not null default 'other'
    check (category in ('social','outreach','pitching','admin','production','other')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  version_id uuid references versions(id) on delete set null,
  note text not null,
  logged_at timestamptz not null default now()
);

-- ---------- v0.5 tables (created now, used later) ----------

create table comments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references versions(id) on delete cascade,
  timestamp_sec numeric(7,2),
  text text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  version_id uuid references versions(id) on delete set null,
  reviewer text,
  text text not null,
  status text not null default 'open' check (status in ('open','resolved','wont_fix')),
  received_at timestamptz not null default now()
);

-- Board sticky notes (migration 020)
create table if not exists board_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  title text not null,
  body text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_notes_title_len check (
    char_length(trim(title)) >= 1 and char_length(title) <= 120
  )
);

create index if not exists idx_board_notes_space_stage
  on board_notes (space_id, stage_id, sort);

-- ---------- Row Level Security (single-user: you can only see your own data) ----------

alter table spaces enable row level security;
alter table stages enable row level security;
alter table projects enable row level security;
alter table tracks enable row level security;
alter table versions enable row level security;
alter table assets enable row level security;
alter table checklist_items enable row level security;
alter table templates enable row level security;
alter table tasks enable row level security;
alter table sessions enable row level security;
alter table comments enable row level security;
alter table feedback enable row level security;
alter table board_notes enable row level security;
alter table artists enable row level security; -- migration 021

create policy own_artists on artists for all using (user_id = auth.uid()) with check (user_id = auth.uid()); -- migration 021
create policy own_spaces on spaces for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_projects on projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_tracks on tracks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_templates on templates for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_tasks on tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_stages on stages for all
  using (exists (select 1 from spaces s where s.id = space_id and s.user_id = auth.uid()))
  with check (exists (select 1 from spaces s where s.id = space_id and s.user_id = auth.uid()));

create policy own_versions on versions for all
  using (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()))
  with check (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()));

create policy own_assets on assets for all
  using (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()))
  with check (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()));

create policy own_checklist on checklist_items for all
  using (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()))
  with check (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()));

create policy own_sessions on sessions for all
  using (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()))
  with check (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()));

create policy own_comments on comments for all
  using (exists (select 1 from versions v join tracks t on t.id = v.track_id
                 where v.id = version_id and t.user_id = auth.uid()))
  with check (exists (select 1 from versions v join tracks t on t.id = v.track_id
                 where v.id = version_id and t.user_id = auth.uid()));

create policy own_feedback on feedback for all
  using (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()))
  with check (exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid()));

create policy own_board_notes on board_notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage policies for the private 'audio' bucket
create policy "own audio read" on storage.objects for select
  using (bucket_id = 'audio' and owner = auth.uid());
create policy "own audio insert" on storage.objects for insert
  with check (bucket_id = 'audio' and owner = auth.uid());
create policy "own audio delete" on storage.objects for delete
  using (bucket_id = 'audio' and owner = auth.uid());

-- Helpful indexes
create index idx_tracks_space on tracks(space_id);
create index idx_tracks_stage on tracks(stage_id);
create index idx_versions_track on versions(track_id);
create index idx_assets_track on assets(track_id);
create index idx_checklist_track on checklist_items(track_id);
create index idx_tasks_due on tasks(due_date);
create index idx_sessions_track on sessions(track_id);

-- ---------- Additive schema from migrations 001–011 (canonical snapshot notes) ----------
-- Prefer running numbered files in /migrations on live databases.
-- The blocks below document the intended end state for greenfield installs.

-- 001 track workflow
alter table tracks add column if not exists next_action text;
alter table tracks add column if not exists next_action_due date;
alter table tracks add column if not exists blocked_reason text;
alter table tracks add column if not exists waiting_on text;
alter table tracks add column if not exists stage_entered_at timestamptz not null default now();

-- 002 comments extensions (see migrations/002_timestamped_comments.sql)
-- 003 guest_review_links (see migrations/003_guest_review_links.sql)
-- 004 version milestones + version_decisions
-- 005 stage_recipes + stage_recipe_runs
-- 006 sessions focus fields
-- 007 track_references
-- 008 projects.project_type + release_details + release_track_metadata
-- 009 track_collaborators + activity_events + notifications + RLS helpers
-- 010 user_track_workspace_preferences
-- 011 dashboard aggregate views

-- Full SQL for each lives in /migrations — run 001 through 011 in order on production.
