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
drop policy if exists insert_own_tracks on tracks;
create policy insert_own_tracks on tracks for insert
  with check (user_id = auth.uid());
drop policy if exists update_tracks on tracks;
create policy update_tracks on tracks for update
  using (user_id = auth.uid() or can_edit_track(id))
  with check (user_id = auth.uid() or can_edit_track(id));
drop policy if exists delete_own_tracks on tracks;
create policy delete_own_tracks on tracks for delete
  using (user_id = auth.uid());

drop policy if exists own_versions on versions;
drop policy if exists select_versions on versions;
create policy select_versions on versions for select
  using (can_read_track(track_id));
drop policy if exists insert_versions on versions;
create policy insert_versions on versions for insert
  with check (can_upload_track(track_id));
drop policy if exists update_versions on versions;
create policy update_versions on versions for update
  using (can_edit_track(track_id) or can_upload_track(track_id))
  with check (can_edit_track(track_id) or can_upload_track(track_id));
drop policy if exists delete_versions on versions;
create policy delete_versions on versions for delete
  using (is_track_owner(track_id) or can_edit_track(track_id));

drop policy if exists own_assets on assets;
drop policy if exists select_assets on assets;
create policy select_assets on assets for select using (can_read_track(track_id));
drop policy if exists insert_assets on assets;
create policy insert_assets on assets for insert with check (can_upload_track(track_id));
drop policy if exists update_assets on assets;
create policy update_assets on assets for update
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));
drop policy if exists delete_assets on assets;
create policy delete_assets on assets for delete
  using (is_track_owner(track_id) or can_edit_track(track_id));

drop policy if exists own_checklist on checklist_items;
drop policy if exists select_checklist on checklist_items;
create policy select_checklist on checklist_items for select using (can_read_track(track_id));
drop policy if exists write_checklist on checklist_items;
create policy write_checklist on checklist_items for all
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));

drop policy if exists own_sessions on sessions;
drop policy if exists select_sessions on sessions;
create policy select_sessions on sessions for select using (can_read_track(track_id));
drop policy if exists write_sessions on sessions;
create policy write_sessions on sessions for all
  using (is_track_owner(track_id) or can_edit_track(track_id))
  with check (is_track_owner(track_id) or can_edit_track(track_id));

drop policy if exists own_comments on comments;
drop policy if exists select_comments on comments;
create policy select_comments on comments for select using (can_read_track(track_id));
drop policy if exists insert_comments on comments;
create policy insert_comments on comments for insert with check (can_comment_track(track_id));
drop policy if exists update_comments on comments;
create policy update_comments on comments for update
  using (
    is_track_owner(track_id) or can_edit_track(track_id)
    or (author_user_id = auth.uid() and resolved = false)
  )
  with check (
    is_track_owner(track_id) or can_edit_track(track_id)
    or (author_user_id = auth.uid() and resolved = false)
  );
drop policy if exists delete_comments on comments;
create policy delete_comments on comments for delete
  using (
    is_track_owner(track_id) or can_edit_track(track_id)
    or (author_user_id = auth.uid() and resolved = false)
  );

drop policy if exists own_feedback on feedback;
drop policy if exists select_feedback on feedback;
create policy select_feedback on feedback for select using (can_read_track(track_id));
drop policy if exists write_feedback on feedback;
create policy write_feedback on feedback for all
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));

drop policy if exists own_track_references on track_references;
drop policy if exists select_track_references on track_references;
create policy select_track_references on track_references for select using (can_read_track(track_id));
drop policy if exists write_track_references on track_references;
create policy write_track_references on track_references for all
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));

drop policy if exists own_version_decisions on version_decisions;
drop policy if exists select_version_decisions on version_decisions;
create policy select_version_decisions on version_decisions for select using (can_read_track(track_id));
drop policy if exists write_version_decisions on version_decisions;
create policy write_version_decisions on version_decisions for all
  using (can_edit_track(track_id)) with check (can_edit_track(track_id));

drop policy if exists own_guest_links on guest_review_links;
create policy own_guest_links on guest_review_links for all
  using (is_track_owner(track_id)) with check (is_track_owner(track_id));
