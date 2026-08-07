-- TEMPO migration 053 — Scenes, part 5: scene chat
-- Additive. Depends on 031 (messaging) and 049 (scenes, membership).
--
-- NO POLICY ON ANY 031 TABLE IS TOUCHED BY THIS FILE.
--
-- `conversations.kind = 'group'` has existed since 031 and has never been
-- used. It already satisfies both of its own constraints for a scene room
-- (direct_key null, title non-empty), so scene chat is two nullable columns
-- and a pair of triggers. is_conversation_participant() stays the single
-- membership oracle for messaging, select_messages/insert_messages are
-- unchanged, and hooks/use-realtime-inbox.ts picks scene chat up for free.
--
-- Participant rows are MATERIALIZED rather than derived from scene_members,
-- for two reasons: a joining member has no INSERT on a conversation they are
-- not yet in (so the write must be definer anyway), and last_read_at / muted
-- are per-member state the existing inbox reads directly off that table.

alter table conversations
  add column if not exists scene_id uuid references scenes(id) on delete cascade,
  add column if not exists scene_topic_id uuid references scene_topics(id) on delete cascade;

-- One room per scene, and one per topic that opts into its own thread.
create unique index if not exists uq_conversations_scene_room
  on conversations (scene_id) where scene_id is not null and scene_topic_id is null;
create unique index if not exists uq_conversations_scene_topic_room
  on conversations (scene_topic_id) where scene_topic_id is not null;

-- ---------- room creation ----------

create or replace function ensure_scene_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from conversations
  where scene_id = new.id and scene_topic_id is null;
  if v_id is not null then return new; end if;

  insert into conversations (kind, title, created_by_profile_id, scene_id)
  values ('group', new.name, new.owner_profile_id, new.id)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then return new; end if;

  -- The seed trigger in 049 has already written the owner's membership row.
  insert into conversation_participants (conversation_id, profile_id, user_id, role)
  select v_id, m.profile_id, m.user_id, 'admin'
  from scene_members m
  where m.scene_id = new.id and m.status = 'active'
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_ensure_scene_conversation on scenes;
create trigger trg_ensure_scene_conversation after insert on scenes
  for each row execute function ensure_scene_conversation();

-- Keep the thread title in step with the scene name, so the inbox never shows
-- a stale room name next to a renamed scene.
create or replace function sync_scene_conversation_title() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update conversations set title = new.name
    where scene_id = new.id and scene_topic_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_scene_conversation_title on scenes;
create trigger trg_sync_scene_conversation_title after update of name on scenes
  for each row execute function sync_scene_conversation_title();

-- ---------- membership mirror ----------
-- Becoming active puts you in the room; leaving or being banned sets left_at,
-- which is exactly what is_conversation_participant() already tests. Nobody
-- keeps read access to a room they were removed from, and no 031 code had to
-- learn what a scene is.

create or replace function sync_scene_chat_participant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_conv uuid;
  v_role text;
begin
  select id into v_conv from conversations
  where scene_id = new.scene_id and scene_topic_id is null;
  if v_conv is null then return new; end if;

  v_role := case when new.role in ('owner', 'moderator') then 'admin' else 'member' end;

  if new.status = 'active' then
    insert into conversation_participants (conversation_id, profile_id, user_id, role)
    values (v_conv, new.profile_id, new.user_id, v_role)
    on conflict (conversation_id, profile_id) do update
      set left_at = null, role = excluded.role;
  else
    update conversation_participants set left_at = coalesce(left_at, now())
    where conversation_id = v_conv and profile_id = new.profile_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_scene_chat_participant on scene_members;
create trigger trg_sync_scene_chat_participant
  after insert or update of status, role on scene_members
  for each row execute function sync_scene_chat_participant();

-- ---------- backfill ----------
-- 049–052 can be run days before this file, so scenes may already exist with
-- members and no room. This makes the trigger's effect retroactive.

do $$
declare s record;
begin
  for s in select id, name, owner_profile_id from scenes loop
    if not exists (
      select 1 from conversations c where c.scene_id = s.id and c.scene_topic_id is null
    ) then
      insert into conversations (kind, title, created_by_profile_id, scene_id)
      values ('group', s.name, s.owner_profile_id, s.id);
    end if;
  end loop;

  insert into conversation_participants (conversation_id, profile_id, user_id, role)
  select c.id, m.profile_id, m.user_id,
         case when m.role in ('owner', 'moderator') then 'admin' else 'member' end
  from conversations c
  join scene_members m on m.scene_id = c.scene_id and m.status = 'active'
  where c.scene_id is not null and c.scene_topic_id is null
  on conflict do nothing;
end $$;
