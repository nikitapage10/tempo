-- TEMPO combined migrations 001–011
-- Paste into Supabase SQL Editor and Run once. Additive only.


-- ========== 001_track_workflow.sql ==========

-- TEMPO migration 001 — track workflow fields (Prompt 2)
-- Additive only. Run in Supabase SQL Editor. Do not drop/truncate tables.

alter table tracks
  add column if not exists next_action text,
  add column if not exists next_action_due date,
  add column if not exists blocked_reason text,
  add column if not exists waiting_on text,
  add column if not exists stage_entered_at timestamptz not null default now();

-- Backfill stage_entered_at for existing rows (already defaulted; keep updated_at as hint)
update tracks
set stage_entered_at = coalesce(updated_at, created_at, now())
where stage_entered_at is null;

create index if not exists idx_tracks_attention
  on tracks (user_id, momentum, next_action_due)
  where momentum in ('active', 'simmering', 'stalled');

create or replace function set_stage_entered_at() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    new.stage_entered_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stage_entered_at on tracks;
create trigger trg_stage_entered_at
  before update of stage_id on tracks
  for each row execute function set_stage_entered_at();


-- ========== 002_timestamped_comments.sql ==========

-- TEMPO migration 002 — timestamped comments (Prompt 3)
-- Preserves existing comments rows. Additive only.

alter table comments
  add column if not exists track_id uuid references tracks(id) on delete cascade,
  add column if not exists author_user_id uuid references auth.users(id) on delete set null,
  add column if not exists parent_id uuid references comments(id) on delete cascade,
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists guest_name text,
  add column if not exists guest_link_id uuid;

-- Backfill track_id from versions
update comments c
set track_id = v.track_id
from versions v
where c.version_id = v.id
  and c.track_id is null;

-- Only tighten NOT NULL when every row has track_id
do $$
begin
  if not exists (select 1 from comments where track_id is null) then
    alter table comments alter column track_id set not null;
  end if;
end $$;

-- Sync resolved boolean <-> resolved_at
create or replace function sync_comment_resolved() returns trigger as $$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.resolved and new.resolved_at is null then
      new.resolved_at := now();
    elsif not new.resolved then
      new.resolved_at := null;
      new.resolved_by_user_id := null;
    end if;
    if new.resolved_at is not null and not new.resolved then
      new.resolved := true;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_comment_resolved on comments;
create trigger trg_sync_comment_resolved
  before insert or update on comments
  for each row execute function sync_comment_resolved();

create index if not exists idx_comments_version_ts on comments (version_id, timestamp_sec);
create index if not exists idx_comments_track_resolved on comments (track_id, resolved);
create index if not exists idx_comments_parent on comments (parent_id);
create index if not exists idx_comments_assigned on comments (assigned_to_user_id);

drop policy if exists own_comments on comments;
create policy own_comments on comments for all
  using (
    exists (
      select 1 from tracks t
      where t.id = comments.track_id and t.user_id = auth.uid()
    )
    or exists (
      select 1 from versions v
      join tracks t on t.id = v.track_id
      where v.id = comments.version_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tracks t
      where t.id = comments.track_id and t.user_id = auth.uid()
    )
    or exists (
      select 1 from versions v
      join tracks t on t.id = v.track_id
      where v.id = comments.version_id and t.user_id = auth.uid()
    )
  );


-- ========== 003_guest_review_links.sql ==========

-- TEMPO migration 003 — guest review links (Prompt 4)
-- Additive only. No anon select policies — server validates tokens via service role.

create table if not exists guest_review_links (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  version_id uuid not null references versions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  allow_comments boolean not null default true,
  allow_download boolean not null default false,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create index if not exists idx_guest_links_track on guest_review_links (track_id);
create index if not exists idx_guest_links_version on guest_review_links (version_id);
create index if not exists idx_guest_links_token on guest_review_links (token_hash)
  where revoked_at is null;

alter table comments
  add column if not exists guest_name text,
  add column if not exists guest_link_id uuid;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'comments_guest_link_id_fkey'
  ) then
    alter table comments
      add constraint comments_guest_link_id_fkey
      foreign key (guest_link_id) references guest_review_links(id) on delete set null;
  end if;
end $$;

alter table guest_review_links enable row level security;

drop policy if exists own_guest_links on guest_review_links;
create policy own_guest_links on guest_review_links for all
  using (
    exists (
      select 1 from tracks t
      where t.id = track_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tracks t
      where t.id = track_id and t.user_id = auth.uid()
    )
  );


-- ========== 004_version_milestones_and_decisions.sql ==========

-- TEMPO migration 004 — milestones + version decisions (Prompt 5)

alter table versions
  add column if not exists is_pinned boolean not null default false,
  add column if not exists milestone_type text
    check (milestone_type is null or milestone_type in (
      'demo','vocal_comp','arrangement_lock','mix_approved','master','custom'
    )),
  add column if not exists milestone_label text,
  add column if not exists pinned_at timestamptz;

create table if not exists version_decisions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  version_id uuid not null references versions(id) on delete cascade,
  decision_type text not null check (decision_type in ('approved','needs_changes','rejected')),
  decision_area text not null check (decision_area in (
    'general','arrangement','vocal','mix','master','release'
  )),
  note text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  guest_link_id uuid references guest_review_links(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_version_decisions_track on version_decisions (track_id, created_at desc);
create index if not exists idx_version_decisions_version on version_decisions (version_id);
create index if not exists idx_versions_pinned on versions (track_id, is_pinned);

alter table version_decisions enable row level security;

drop policy if exists own_version_decisions on version_decisions;
create policy own_version_decisions on version_decisions for all
  using (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  );


-- ========== 005_stage_recipes.sql ==========

-- TEMPO migration 005 — stage recipes (Prompt 6)

create table if not exists stage_recipes (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null unique references stages(id) on delete cascade,
  enabled boolean not null default true,
  execution_mode text not null default 'preview'
    check (execution_mode in ('preview','automatic')),
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stage_recipe_runs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references stage_recipes(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  transition_key text not null unique,
  status text not null check (status in ('pending','applied','skipped','partial','failed')),
  action_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_recipe_runs_track on stage_recipe_runs (track_id, created_at desc);

alter table stage_recipes enable row level security;
alter table stage_recipe_runs enable row level security;

drop policy if exists own_stage_recipes on stage_recipes;
create policy own_stage_recipes on stage_recipes for all
  using (
    exists (
      select 1 from stages st
      join spaces s on s.id = st.space_id
      where st.id = stage_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from stages st
      join spaces s on s.id = st.space_id
      where st.id = stage_id and s.user_id = auth.uid()
    )
  );

drop policy if exists own_stage_recipe_runs on stage_recipe_runs;
create policy own_stage_recipe_runs on stage_recipe_runs for all
  using (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  );


-- ========== 006_focus_sessions.sql ==========

-- TEMPO migration 006 — focus sessions (Prompt 7)

alter table sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'completed'
    check (status in ('active','completed','abandoned')),
  add column if not exists goal text,
  add column if not exists outcome text,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists elapsed_sec int,
  add column if not exists next_action_after text,
  add column if not exists created_at timestamptz not null default now();

-- Backfill user_id from track ownership
update sessions s
set user_id = t.user_id
from tracks t
where s.track_id = t.id
  and s.user_id is null;

do $$
begin
  if not exists (select 1 from sessions where user_id is null) then
    alter table sessions alter column user_id set not null;
  end if;
end $$;

-- Historical rows: treat as completed
update sessions
set status = 'completed',
    started_at = coalesce(started_at, logged_at),
    ended_at = coalesce(ended_at, logged_at)
where status = 'completed' and started_at is null;

create unique index if not exists idx_sessions_one_active_per_user
  on sessions (user_id)
  where status = 'active';

create index if not exists idx_sessions_user_status on sessions (user_id, status);


-- ========== 007_track_references.sql ==========

-- TEMPO migration 007 — track references (Prompt 8)

create table if not exists track_references (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  kind text not null check (kind in ('audio','image','link','note')),
  title text not null,
  url text,
  asset_id uuid references assets(id) on delete set null,
  note text,
  start_sec numeric,
  end_sec numeric,
  intent text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_track_references_track on track_references (track_id, sort);

alter table track_references enable row level security;

drop policy if exists own_track_references on track_references;
create policy own_track_references on track_references for all
  using (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  );


-- ========== 008_release_workspace.sql ==========

-- TEMPO migration 008 — release workspace (Prompt 9)

alter table projects
  add column if not exists project_type text not null default 'general'
    check (project_type in ('general','single','ep','album','edit_pack'));

create table if not exists release_details (
  project_id uuid primary key references projects(id) on delete cascade,
  release_date date,
  label_name text,
  distributor text,
  catalog_number text,
  upc text,
  pre_save_url text,
  live_url text,
  pitching_deadline date,
  submitted_at timestamptz,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists release_track_metadata (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  track_number int,
  version_title text,
  isrc text,
  explicit boolean not null default false,
  primary_artist text,
  featured_artists text[] not null default '{}',
  writers text[] not null default '{}',
  producers text[] not null default '{}',
  mix_engineer text,
  mastering_engineer text,
  unique (project_id, track_id)
);

create index if not exists idx_release_meta_project on release_track_metadata (project_id);

alter table release_details enable row level security;
alter table release_track_metadata enable row level security;

drop policy if exists own_release_details on release_details;
create policy own_release_details on release_details for all
  using (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists own_release_track_metadata on release_track_metadata;
create policy own_release_track_metadata on release_track_metadata for all
  using (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  );


-- ========== 009_track_collaboration.sql ==========

-- TEMPO migration 009 — track collaboration, activity, notifications (Prompt 10)
-- HIGH RISK. Test on a non-production account first.
-- Owner remains tracks.user_id and is NOT duplicated as a collaborator row.

create table if not exists track_collaborators (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null check (role in ('editor','uploader','commenter','viewer')),
  status text not null check (status in ('pending','active','revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invite_token_hash text unique,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_track_collab_track on track_collaborators (track_id);
create index if not exists idx_track_collab_user on track_collaborators (user_id) where status = 'active';
create index if not exists idx_track_collab_email on track_collaborators (invited_email) where status = 'pending';

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_track on activity_events (track_id, created_at desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications (user_id, created_at desc);

-- Non-recursive role helpers
create or replace function is_track_owner(p_track_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tracks t where t.id = p_track_id and t.user_id = auth.uid()
  );
$$;

create or replace function track_collaborator_role(p_track_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select c.role from track_collaborators c
  where c.track_id = p_track_id
    and c.user_id = auth.uid()
    and c.status = 'active'
  limit 1;
$$;

create or replace function can_read_track(p_track_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_track_owner(p_track_id)
    or track_collaborator_role(p_track_id) is not null;
$$;

create or replace function can_edit_track(p_track_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_track_owner(p_track_id)
    or track_collaborator_role(p_track_id) = 'editor';
$$;

create or replace function can_upload_track(p_track_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_track_owner(p_track_id)
    or track_collaborator_role(p_track_id) in ('editor','uploader');
$$;

create or replace function can_comment_track(p_track_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_track_owner(p_track_id)
    or track_collaborator_role(p_track_id) in ('editor','commenter');
$$;

alter table track_collaborators enable row level security;
alter table activity_events enable row level security;
alter table notifications enable row level security;

drop policy if exists own_track_collaborators on track_collaborators;
create policy own_track_collaborators on track_collaborators for all
  using (
    is_track_owner(track_id)
    or (user_id = auth.uid())
  )
  with check (is_track_owner(track_id));

drop policy if exists read_activity on activity_events;
create policy read_activity on activity_events for select
  using (can_read_track(track_id));

drop policy if exists write_activity on activity_events;
create policy write_activity on activity_events for insert
  with check (can_read_track(track_id));

drop policy if exists own_notifications on notifications;
create policy own_notifications on notifications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Expand track read access for collaborators (preserve owner full access)
drop policy if exists own_tracks on tracks;
create policy own_tracks on tracks for select
  using (user_id = auth.uid() or can_read_track(id));
create policy insert_own_tracks on tracks for insert
  with check (user_id = auth.uid());
create policy update_tracks on tracks for update
  using (user_id = auth.uid() or can_edit_track(id))
  with check (user_id = auth.uid() or can_edit_track(id));
create policy delete_own_tracks on tracks for delete
  using (user_id = auth.uid());

drop policy if exists own_versions on versions;
create policy select_versions on versions for select
  using (can_read_track(track_id));
create policy insert_versions on versions for insert
  with check (can_upload_track(track_id));
create policy update_versions on versions for update
  using (can_edit_track(track_id) or can_upload_track(track_id))
  with check (can_edit_track(track_id) or can_upload_track(track_id));
create policy delete_versions on versions for delete
  using (is_track_owner(track_id) or can_edit_track(track_id));

drop policy if exists own_assets on assets;
create policy select_assets on assets for select using (can_read_track(track_id));
create policy insert_assets on assets for insert with check (can_upload_track(track_id));
create policy update_assets on assets for update
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));
create policy delete_assets on assets for delete
  using (is_track_owner(track_id) or can_edit_track(track_id));

drop policy if exists own_checklist on checklist_items;
create policy select_checklist on checklist_items for select using (can_read_track(track_id));
create policy write_checklist on checklist_items for all
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));

drop policy if exists own_sessions on sessions;
create policy select_sessions on sessions for select using (can_read_track(track_id));
create policy write_sessions on sessions for all
  using (is_track_owner(track_id) or can_edit_track(track_id))
  with check (is_track_owner(track_id) or can_edit_track(track_id));

drop policy if exists own_comments on comments;
create policy select_comments on comments for select using (can_read_track(track_id));
create policy insert_comments on comments for insert with check (can_comment_track(track_id));
create policy update_comments on comments for update
  using (
    is_track_owner(track_id) or can_edit_track(track_id)
    or (author_user_id = auth.uid() and resolved = false)
  )
  with check (
    is_track_owner(track_id) or can_edit_track(track_id)
    or (author_user_id = auth.uid() and resolved = false)
  );
create policy delete_comments on comments for delete
  using (
    is_track_owner(track_id) or can_edit_track(track_id)
    or (author_user_id = auth.uid() and resolved = false)
  );

drop policy if exists own_feedback on feedback;
create policy select_feedback on feedback for select using (can_read_track(track_id));
create policy write_feedback on feedback for all
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));

drop policy if exists own_track_references on track_references;
create policy select_track_references on track_references for select using (can_read_track(track_id));
create policy write_track_references on track_references for all
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));

drop policy if exists own_version_decisions on version_decisions;
create policy select_version_decisions on version_decisions for select using (can_read_track(track_id));
create policy write_version_decisions on version_decisions for all
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));

drop policy if exists own_guest_links on guest_review_links;
create policy own_guest_links on guest_review_links for all
  using (is_track_owner(track_id)) with check (is_track_owner(track_id));


-- ========== 010_workspace_preferences.sql ==========

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


-- ========== 011_dashboard_aggregates.sql ==========

-- TEMPO migration 011 — dashboard aggregates helpers (Prompt 12)
-- Non-destructive views for Today/Board attention without loading every comment row.

create or replace view track_unresolved_comment_counts as
select
  track_id,
  count(*)::int as unresolved_count
from comments
where resolved = false
  and parent_id is null
group by track_id;

create or replace view track_latest_session as
select distinct on (track_id)
  track_id,
  logged_at as last_session_at,
  status as last_session_status
from sessions
order by track_id, logged_at desc;

-- Note: views inherit underlying table RLS via security_invoker when available.
-- On older Postgres, access still goes through comments/sessions policies for owners.

