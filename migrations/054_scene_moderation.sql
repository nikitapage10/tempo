-- TEMPO migration 054 — Scenes, part 6: scene-local moderation
-- Additive. Depends on 049, 050 and 033 (content_reports).
--
-- The load-bearing idea: managers moderate their own room, and the platform
-- operator only ever sees what a member deliberately reported or a manager
-- deliberately escalated. Routing every scene squabble into /admin/reports
-- would quietly make the operator the moderator of every community on TEMPO,
-- which does not scale past a handful of scenes.
--
--   local action  (pin, remove, mute, ban, role change) → scene_moderation_log
--   member report / manager escalation                  → content_reports
--
-- content_reports is a 033 table, so widening its check here is permitted
-- under the 028 rule (no migration ≥028 alters a policy on a pre-027 table).

-- ---------- scene_moderation_log ----------
-- Shaped like admin_audit_log (033): append-only, never updated, readable by
-- the scene's own managers so a moderation decision can be explained later.

create table if not exists scene_moderation_log (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  actor_profile_id uuid references artist_profiles(id) on delete set null,
  action text not null check (action in (
    'pin', 'unpin', 'remove_post', 'restore_post',
    'mute', 'unmute', 'ban', 'unban',
    'approve', 'reject', 'role_change', 'escalate'
  )),
  target_type text not null check (target_type in ('post', 'post_comment', 'member')),
  target_id uuid not null,
  note text,
  created_at timestamptz not null default now(),
  constraint scene_moderation_log_note_len check (note is null or char_length(note) <= 1000)
);

create index if not exists idx_scene_moderation_log_scene
  on scene_moderation_log (scene_id, created_at desc);

alter table scene_moderation_log enable row level security;

drop policy if exists select_scene_moderation_log on scene_moderation_log;
create policy select_scene_moderation_log on scene_moderation_log for select
  to authenticated using (is_scene_manager(scene_id));

-- Written only by the definer RPCs below — never by a client directly, so the
-- log cannot be forged or back-dated by the person it would incriminate.
drop policy if exists insert_scene_moderation_log on scene_moderation_log;
create policy insert_scene_moderation_log on scene_moderation_log for insert
  to authenticated with check (false);

create or replace function log_scene_moderation(
  p_scene_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into scene_moderation_log (scene_id, actor_profile_id, action, target_type, target_id, note)
  values (p_scene_id, scene_member_profile_id(p_scene_id), p_action, p_target_type, p_target_id, p_note);
end;
$$;

revoke execute on function log_scene_moderation(uuid, text, text, uuid, text)
  from public, anon, authenticated;

-- ---------- rewrites that add logging ----------
-- Each of these REPLACES a definition from 049/050. Not a no-op: the guard
-- clauses are identical and a log write is appended. Same pattern as 029
-- replacing 028's profile_is_readable.

create or replace function scene_remove_post(p_post_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_scene uuid;
begin
  select scene_id into v_scene from posts where id = p_post_id;
  if v_scene is null then
    raise exception 'That post is not in a scene' using errcode = '42501';
  end if;
  if not is_scene_manager(v_scene) then
    raise exception 'Only a scene owner or moderator can remove a post' using errcode = '42501';
  end if;
  update posts set deleted_at = now() where id = p_post_id and deleted_at is null;
  perform log_scene_moderation(v_scene, 'remove_post', 'post', p_post_id, p_note);
end;
$$;

create or replace function scene_restore_post(p_post_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_scene uuid;
begin
  select scene_id into v_scene from posts where id = p_post_id;
  if v_scene is null or not is_scene_manager(v_scene) then
    raise exception 'Only a scene owner or moderator can restore a post' using errcode = '42501';
  end if;
  update posts set deleted_at = null where id = p_post_id;
  perform log_scene_moderation(v_scene, 'restore_post', 'post', p_post_id, null);
end;
$$;

create or replace function set_scene_post_pinned(p_post_id uuid, p_pinned boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_scene uuid;
begin
  select scene_id into v_scene from posts where id = p_post_id;
  if v_scene is null then
    raise exception 'That post is not in a scene' using errcode = '42501';
  end if;
  if not is_scene_manager(v_scene) then
    raise exception 'Only a scene owner or moderator can pin a post' using errcode = '42501';
  end if;
  update posts set pinned_at = case when p_pinned then now() else null end
  where id = p_post_id;
  perform log_scene_moderation(
    v_scene, case when p_pinned then 'pin' else 'unpin' end, 'post', p_post_id, null
  );
end;
$$;

create or replace function set_scene_member_banned(
  p_scene_id uuid,
  p_profile_id uuid,
  p_banned boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_scene_manager(p_scene_id) then
    raise exception 'Only a scene owner or moderator can do that' using errcode = '42501';
  end if;
  if p_banned and exists (
    select 1 from scene_members
    where scene_id = p_scene_id and profile_id = p_profile_id and role = 'owner'
  ) then
    raise exception 'You cannot ban the scene owner' using errcode = '42501';
  end if;
  update scene_members
  set status = case when p_banned then 'banned' else 'left' end,
      role = 'member'
  where scene_id = p_scene_id and profile_id = p_profile_id;
  perform log_scene_moderation(
    p_scene_id, case when p_banned then 'ban' else 'unban' end, 'member', p_profile_id, null
  );
end;
$$;

create or replace function set_scene_member_role(
  p_scene_id uuid,
  p_profile_id uuid,
  p_role text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_scene_owner(p_scene_id) then
    raise exception 'Only the scene owner can change roles' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'moderator', 'member') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  if p_role = 'owner' then
    update scene_members set role = 'member'
    where scene_id = p_scene_id and role = 'owner' and profile_id <> p_profile_id;
    update scenes s set owner_profile_id = p_profile_id,
      owner_user_id = (select owner_user_id from artist_profiles where id = p_profile_id)
    where s.id = p_scene_id;
  end if;
  update scene_members set role = p_role
  where scene_id = p_scene_id and profile_id = p_profile_id and status = 'active';
  perform log_scene_moderation(p_scene_id, 'role_change', 'member', p_profile_id, p_role);
end;
$$;

create or replace function respond_to_scene_join(
  p_scene_id uuid,
  p_profile_id uuid,
  p_approve boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_scene_manager(p_scene_id) then
    raise exception 'Only a scene owner or moderator can do that' using errcode = '42501';
  end if;
  if p_approve then
    update scene_members set status = 'active', joined_at = coalesce(joined_at, now())
    where scene_id = p_scene_id and profile_id = p_profile_id and status = 'pending';
  else
    update scene_members set status = 'left'
    where scene_id = p_scene_id and profile_id = p_profile_id and status = 'pending';
  end if;
  perform log_scene_moderation(
    p_scene_id, case when p_approve then 'approve' else 'reject' end, 'member', p_profile_id, null
  );
end;
$$;

revoke execute on function scene_restore_post(uuid) from public, anon;
grant execute on function scene_restore_post(uuid) to authenticated;

-- ---------- escalation into the operator queue ----------

do $$
begin
  -- Widen the 033 target list so a scene report is distinguishable from a
  -- home-feed report in /admin/reports.
  if exists (select 1 from pg_constraint where conname = 'content_reports_target_type_check') then
    alter table content_reports drop constraint content_reports_target_type_check;
  end if;
  alter table content_reports add constraint content_reports_target_type_check
    check (target_type in (
      'post', 'post_comment', 'profile',
      'scene_post', 'scene_comment', 'scene'
    ));
end $$;

-- Carries which room a report came from, so the operator can see a pattern
-- (one bad scene) rather than a stream of unrelated posts.
alter table content_reports
  add column if not exists scene_id uuid references scenes(id) on delete set null;

create index if not exists idx_content_reports_scene
  on content_reports (scene_id, created_at desc) where scene_id is not null;

create or replace function escalate_scene_report(
  p_scene_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_scene_manager(p_scene_id) then
    raise exception 'Only a scene owner or moderator can escalate' using errcode = '42501';
  end if;
  if p_target_type not in ('scene_post', 'scene_comment') then
    raise exception 'Unknown target' using errcode = '22023';
  end if;
  insert into content_reports (
    reporter_profile_id, target_type, target_id, reason, details, scene_id
  ) values (
    scene_member_profile_id(p_scene_id), p_target_type, p_target_id, p_reason, p_details, p_scene_id
  ) returning id into v_id;
  perform log_scene_moderation(p_scene_id, 'escalate', 'post', p_target_id, p_reason);
  return v_id;
end;
$$;

revoke execute on function escalate_scene_report(uuid, text, uuid, text, text) from public, anon;
grant execute on function escalate_scene_report(uuid, text, uuid, text, text) to authenticated;
