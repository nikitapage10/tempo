-- TEMPO migration 101: Team Operations permission truth and membership lifecycle.
-- Additive/rerunnable. Run after 100. Existing grants are preserved and only
-- missing split-area keys are derived from the legacy catalog grant.

create or replace function is_valid_area_grants(p_areas jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(p_areas) = 'object'
    and not exists (
      select 1 from jsonb_each_text(p_areas) e
      where e.key not in (
        'catalog', 'audio', 'feedback', 'tasks', 'calendar', 'releases',
        'stats', 'performances', 'social', 'team'
      ) or e.value not in ('none', 'read', 'write')
    )
    and coalesce(p_areas->>'stats','none') <> 'write'
    and coalesce(p_areas->>'social','none') <> 'write'
    and coalesce(p_areas->>'team','none') <> 'write';
$$;

-- Compatibility split: never replace an explicit value. Stats, Social and
-- Team are deliberately normalized to their safe v1 ceilings.
update artist_members
set areas = areas
  || case when areas ? 'audio' then '{}'::jsonb else jsonb_build_object('audio', coalesce(areas->>'catalog', 'none')) end
  || case when areas ? 'feedback' then '{}'::jsonb else jsonb_build_object('feedback', coalesce(areas->>'catalog', 'none')) end
  || case when areas ? 'tasks' then '{}'::jsonb else jsonb_build_object('tasks', coalesce(areas->>'catalog', 'none')) end
  || jsonb_build_object(
       'stats', case when coalesce(areas->>'stats', 'none') = 'write' then 'read' else coalesce(areas->>'stats', 'none') end,
       'social', case when coalesce(areas->>'social', 'none') = 'write' then 'read' else coalesce(areas->>'social', 'none') end,
       'team', 'none'
     );

alter table artist_members
  add column if not exists relationship_label text,
  add column if not exists invite_message text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists ended_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table artist_members drop constraint if exists artist_members_status_check;
alter table artist_members add constraint artist_members_status_check
  check (status in ('pending', 'active', 'suspended', 'revoked', 'declined'));
alter table artist_members drop constraint if exists artist_members_relationship_label_check;
alter table artist_members add constraint artist_members_relationship_label_check
  check (relationship_label is null or char_length(btrim(relationship_label)) between 1 and 80);
alter table artist_members drop constraint if exists artist_members_invite_message_check;
alter table artist_members add constraint artist_members_invite_message_check
  check (invite_message is null or char_length(invite_message) <= 1000);
alter table artist_members drop constraint if exists artist_members_ended_reason_check;
alter table artist_members add constraint artist_members_ended_reason_check
  check (ended_reason is null or ended_reason in (
    'left_by_member', 'ended_by_owner', 'invite_declined',
    'invite_expired', 'account_removed'
  ));

create or replace function touch_artist_member_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_artist_member_updated_at on artist_members;
create trigger trg_artist_member_updated_at before update on artist_members
for each row execute function touch_artist_member_updated_at();

create table if not exists artist_membership_events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  membership_id uuid references artist_members(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'invited', 'accepted', 'declined', 'role_changed', 'access_changed',
    'suspended', 'resumed', 'left', 'revoked', 'work_reassigned'
  )),
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint artist_membership_events_changes_object check (jsonb_typeof(changes) = 'object')
);
create index if not exists idx_artist_membership_events_scope
  on artist_membership_events (artist_id, created_at desc);
alter table artist_membership_events enable row level security;
drop policy if exists read_artist_membership_events on artist_membership_events;
create policy read_artist_membership_events on artist_membership_events for select
  using (is_artist_owner(artist_id) or subject_user_id = auth.uid());

create or replace function audit_artist_member_access_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.role is distinct from old.role then
    insert into artist_membership_events(artist_id,membership_id,subject_user_id,actor_user_id,event_type,changes)
      values(new.artist_id,new.id,new.user_id,auth.uid(),'role_changed',jsonb_build_object('old_role',old.role,'new_role',new.role));
  end if;
  if new.areas is distinct from old.areas then
    insert into artist_membership_events(artist_id,membership_id,subject_user_id,actor_user_id,event_type,changes)
      values(new.artist_id,new.id,new.user_id,auth.uid(),'access_changed',jsonb_build_object('old_areas',old.areas,'new_areas',new.areas));
  end if;
  return new;
end; $$;
drop trigger if exists trg_audit_artist_member_access on artist_members;
create trigger trg_audit_artist_member_access after update of role,areas on artist_members
for each row execute function audit_artist_member_access_change();

-- Closed-area helpers. They return identifiers/booleans only and bypass RLS
-- solely to make downstream policies deterministic.
create or replace function artist_id_for_space(p_space_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select artist_id from spaces where id = p_space_id;
$$;
create or replace function can_read_space_area(p_space_id uuid, p_area text) returns boolean
language sql stable security definer set search_path = public as $$
  select can_read_artist_area(artist_id_for_space(p_space_id), p_area);
$$;
create or replace function can_write_space_area(p_space_id uuid, p_area text) returns boolean
language sql stable security definer set search_path = public as $$
  select can_write_artist_area(artist_id_for_space(p_space_id), p_area);
$$;
revoke execute on function artist_id_for_space(uuid) from public, anon;
revoke execute on function can_read_space_area(uuid, text) from public, anon;
revoke execute on function can_write_space_area(uuid, text) from public, anon;
grant execute on function artist_id_for_space(uuid) to authenticated;
grant execute on function can_read_space_area(uuid, text) to authenticated;
grant execute on function can_write_space_area(uuid, text) to authenticated;

create or replace function artist_id_for_track(p_track_id uuid) returns uuid
language sql stable security definer set search_path=public as $$
  select s.artist_id from tracks t join spaces s on s.id=t.space_id where t.id=p_track_id;
$$;
revoke execute on function artist_id_for_track(uuid) from public,anon;
grant execute on function artist_id_for_track(uuid) to authenticated;

-- Split catalog metadata from audio/files, feedback, tasks, and releases.
-- Owner policies remain untouched; these are member-only additive policies.
drop policy if exists member_read_versions_audio on versions;
create policy member_read_versions_audio on versions for select using(can_read_artist_area(artist_id_for_track(track_id),'audio'));
drop policy if exists member_write_versions_audio_insert on versions;
create policy member_write_versions_audio_insert on versions for insert with check(can_write_artist_area(artist_id_for_track(track_id),'audio'));
drop policy if exists member_write_versions_audio_update on versions;
create policy member_write_versions_audio_update on versions for update using(can_write_artist_area(artist_id_for_track(track_id),'audio')) with check(can_write_artist_area(artist_id_for_track(track_id),'audio'));
drop policy if exists member_read_assets_audio on assets;
create policy member_read_assets_audio on assets for select using(can_read_artist_area(artist_id_for_track(track_id),'audio'));
drop policy if exists member_write_assets_audio_insert on assets;
create policy member_write_assets_audio_insert on assets for insert with check(can_write_artist_area(artist_id_for_track(track_id),'audio'));
drop policy if exists member_read_comments_feedback on comments;
create policy member_read_comments_feedback on comments for select using(
  exists(select 1 from versions v where v.id=version_id and can_read_artist_area(artist_id_for_track(v.track_id),'feedback'))
);
drop policy if exists member_write_comments_feedback_insert on comments;
create policy member_write_comments_feedback_insert on comments for insert with check(
  exists(select 1 from versions v where v.id=version_id and can_write_artist_area(artist_id_for_track(v.track_id),'feedback'))
);
drop policy if exists member_write_comments_feedback_update on comments;
create policy member_write_comments_feedback_update on comments for update using(
  exists(select 1 from versions v where v.id=version_id and can_write_artist_area(artist_id_for_track(v.track_id),'feedback'))
) with check(
  exists(select 1 from versions v where v.id=version_id and can_write_artist_area(artist_id_for_track(v.track_id),'feedback'))
);
drop policy if exists member_read_feedback on feedback;
create policy member_read_feedback on feedback for select using(can_read_artist_area(artist_id_for_track(track_id),'feedback'));
drop policy if exists member_write_feedback_insert on feedback;
create policy member_write_feedback_insert on feedback for insert with check(can_write_artist_area(artist_id_for_track(track_id),'feedback'));
drop policy if exists member_write_feedback_update on feedback;
create policy member_write_feedback_update on feedback for update using(can_write_artist_area(artist_id_for_track(track_id),'feedback')) with check(can_write_artist_area(artist_id_for_track(track_id),'feedback'));
drop policy if exists member_read_version_decisions on version_decisions;
create policy member_read_version_decisions on version_decisions for select using(can_read_artist_area(artist_id_for_track(track_id),'feedback'));
drop policy if exists member_write_version_decisions on version_decisions;
create policy member_write_version_decisions on version_decisions for insert with check(can_write_artist_area(artist_id_for_track(track_id),'feedback'));
drop policy if exists member_read_release_details on release_details;
create policy member_read_release_details on release_details for select using(
  exists(select 1 from projects p where p.id=project_id and can_read_space_area(p.space_id,'releases'))
);
drop policy if exists member_write_release_details on release_details;
create policy member_write_release_details on release_details for all using(
  exists(select 1 from projects p where p.id=project_id and can_write_space_area(p.space_id,'releases'))
) with check(exists(select 1 from projects p where p.id=project_id and can_write_space_area(p.space_id,'releases')));
drop policy if exists member_read_release_track_metadata on release_track_metadata;
create policy member_read_release_track_metadata on release_track_metadata for select using(
  exists(select 1 from projects p where p.id=project_id and can_read_space_area(p.space_id,'releases'))
);
drop policy if exists member_write_release_track_metadata on release_track_metadata;
create policy member_write_release_track_metadata on release_track_metadata for all using(
  exists(select 1 from projects p where p.id=project_id and can_write_space_area(p.space_id,'releases'))
) with check(exists(select 1 from projects p where p.id=project_id and can_write_space_area(p.space_id,'releases')));

create or replace function effective_artist_access(
  p_artist_id uuid,
  p_user_id uuid default auth.uid()
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_owner uuid;
  v_row artist_members%rowtype;
  v_areas jsonb := '{}'::jsonb;
  v_key text;
begin
  select user_id into v_owner from artists where id = p_artist_id;
  if v_owner is null then raise exception 'Artist unavailable' using errcode = '42501'; end if;
  if p_user_id <> auth.uid() and v_owner <> auth.uid() then
    raise exception 'Access summary unavailable' using errcode = '42501';
  end if;
  select * into v_row from artist_members
    where artist_id = p_artist_id and user_id = p_user_id
    order by created_at desc limit 1;
  foreach v_key in array array['catalog','audio','feedback','tasks','calendar','releases','stats','performances','social','team'] loop
    v_areas := v_areas || jsonb_build_object(
      v_key,
      case
        when p_user_id = v_owner then case when v_key = 'stats' then 'read' else 'write' end
        when v_row.status = 'active' then coalesce(v_row.areas->>v_key, 'none')
        else 'none'
      end
    );
  end loop;
  return jsonb_build_object(
    'artist_id', p_artist_id,
    'user_id', p_user_id,
    'areas', v_areas,
    'is_owner', p_user_id = v_owner,
    'is_active_member', coalesce(v_row.status = 'active', false),
    'is_suspended', coalesce(v_row.status = 'suspended', false),
    'status', coalesce(v_row.status, case when p_user_id = v_owner then 'owner' else 'none' end)
  );
end;
$$;
revoke execute on function effective_artist_access(uuid, uuid) from public, anon;
grant execute on function effective_artist_access(uuid, uuid) to authenticated;

create or replace function respond_to_artist_invite(p_membership_id uuid, p_accept boolean)
returns artist_members
language plpgsql security definer set search_path = public as $$
declare v artist_members%rowtype;
begin
  select * into v from artist_members where id = p_membership_id for update;
  if v.id is null or v.user_id <> auth.uid() or v.status <> 'pending' then
    raise exception 'Invite unavailable' using errcode = '42501';
  end if;
  update artist_members set
    status = case when p_accept then 'active' else 'declined' end,
    accepted_at = case when p_accept then now() else accepted_at end,
    ended_reason = case when p_accept then null else 'invite_declined' end,
    invite_token_hash = null
  where id = v.id returning * into v;
  insert into artist_membership_events
    (artist_id, membership_id, subject_user_id, actor_user_id, event_type, changes)
  values (v.artist_id, v.id, v.user_id, auth.uid(),
    case when p_accept then 'accepted' else 'declined' end,
    jsonb_build_object('status', v.status));
  return v;
end;
$$;

create or replace function suspend_artist_member(p_membership_id uuid) returns artist_members
language plpgsql security definer set search_path = public as $$
declare v artist_members%rowtype;
begin
  select * into v from artist_members where id = p_membership_id for update;
  if v.id is null or not is_artist_owner(v.artist_id) or v.status <> 'active' then
    raise exception 'Membership unavailable' using errcode = '42501';
  end if;
  update artist_members set status='suspended', suspended_at=now(), suspended_by_user_id=auth.uid()
    where id=v.id returning * into v;
  insert into artist_membership_events (artist_id,membership_id,subject_user_id,actor_user_id,event_type,changes)
    values(v.artist_id,v.id,v.user_id,auth.uid(),'suspended',jsonb_build_object('status','suspended'));
  return v;
end; $$;

create or replace function resume_artist_member(p_membership_id uuid) returns artist_members
language plpgsql security definer set search_path = public as $$
declare v artist_members%rowtype;
begin
  select * into v from artist_members where id = p_membership_id for update;
  if v.id is null or not is_artist_owner(v.artist_id) or v.status <> 'suspended' then
    raise exception 'Membership unavailable' using errcode = '42501';
  end if;
  update artist_members set status='active', suspended_at=null, suspended_by_user_id=null
    where id=v.id returning * into v;
  insert into artist_membership_events (artist_id,membership_id,subject_user_id,actor_user_id,event_type,changes)
    values(v.artist_id,v.id,v.user_id,auth.uid(),'resumed',jsonb_build_object('status','active'));
  return v;
end; $$;

revoke execute on function respond_to_artist_invite(uuid, boolean) from public, anon;
revoke execute on function suspend_artist_member(uuid) from public, anon;
revoke execute on function resume_artist_member(uuid) from public, anon;
grant execute on function respond_to_artist_invite(uuid, boolean) to authenticated;
grant execute on function suspend_artist_member(uuid) to authenticated;
grant execute on function resume_artist_member(uuid) to authenticated;

insert into schema_migrations (version, name, checksum, applied_by)
values (101, '101_team_permission_and_lifecycle', 'initial', 'migration-self-register')
on conflict (version) do nothing;
