-- TEMPO migration 111: artist group chats in Messages
-- Additive. Depends on 031 (conversations), 053 (scene_id), 082 (reactions),
-- 103 (team rooms), and 110 (participant unique key).
--
-- Scene rooms and artist team rooms already use conversations.kind = 'group'.
-- This file adds a third kind of group: an ad-hoc chat among artists, started
-- from Messages, with the same can_dm_profile gate as a direct message.
-- Membership writes go through the RPCs below — client inserts are closed.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function is_artist_group_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c
    where c.id = p_conversation_id
      and c.kind = 'group'
      and c.scene_id is null
      and not exists (
        select 1 from artist_team_rooms r where r.conversation_id = c.id
      )
  );
$$;

create or replace function is_group_conversation_admin(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
      and left_at is null
      and role = 'admin'
  );
$$;

revoke execute on function is_artist_group_conversation(uuid) from public, anon;
revoke execute on function is_group_conversation_admin(uuid) from public, anon;
grant execute on function is_artist_group_conversation(uuid) to authenticated;
grant execute on function is_group_conversation_admin(uuid) to authenticated;

-- Clients may update their own mute/archive/read state, but cannot rejoin a
-- thread they left or were removed from. Definers still bypass RLS.
drop policy if exists update_conversation_participants on conversation_participants;
create policy update_conversation_participants on conversation_participants for update
  to authenticated
  using (user_id = auth.uid() and left_at is null)
  with check (user_id = auth.uid());

-- Adding other people always went through start_direct_conversation (definer).
-- Close the leftover client insert path so a participant cannot invite anyone
-- who has DMs closed.
drop policy if exists insert_conversation_participants on conversation_participants;
create policy insert_conversation_participants on conversation_participants for insert
  to authenticated
  with check (false);

-- ---------------------------------------------------------------------------
-- Create / members / leave / rename
-- ---------------------------------------------------------------------------

create or replace function start_group_conversation(
  p_from_profile uuid,
  p_member_profile_ids uuid[],
  p_title text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_from_user uuid;
  v_from_name text;
  v_title text;
  v_member uuid;
  v_user uuid;
  v_name text;
  v_names text[] := '{}';
  v_users uuid[] := '{}';
  v_unique uuid[] := '{}';
  v_count int := 0;
begin
  if not owns_profile(p_from_profile) then
    raise exception 'Not your profile' using errcode = '42501';
  end if;

  select owner_user_id, display_name into v_from_user, v_from_name
  from artist_profiles where id = p_from_profile;
  if v_from_user is null then
    raise exception 'Not your profile' using errcode = '42501';
  end if;

  if p_member_profile_ids is not null then
    for v_member in select distinct unnest(p_member_profile_ids)
    loop
      if v_member is null or v_member = p_from_profile then continue; end if;
      select owner_user_id, display_name into v_user, v_name
      from artist_profiles where id = v_member;
      if v_user is null or v_user = v_from_user then continue; end if;
      if v_user = any(v_users) then continue; end if;
      if not can_dm_profile(v_member) then
        raise exception 'Cannot message this profile' using errcode = '42501';
      end if;
      v_unique := array_append(v_unique, v_member);
      v_users := array_append(v_users, v_user);
      v_names := array_append(v_names, coalesce(nullif(trim(v_name), ''), 'Artist'));
    end loop;
  end if;

  v_count := coalesce(array_length(v_unique, 1), 0);
  if v_count < 1 then
    raise exception 'Add at least one other artist' using errcode = '23514';
  end if;
  if v_count > 19 then
    raise exception 'Groups can have up to 20 people' using errcode = '23514';
  end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then
    v_title := array_to_string(v_names[1:3], ', ');
    if v_count > 3 then
      v_title := v_title || ' +' || (v_count - 3)::text;
    end if;
  end if;
  if v_title is null or char_length(trim(v_title)) = 0 then
    v_title := 'Group chat';
  end if;
  v_title := left(v_title, 80);

  insert into conversations (kind, title, created_by_profile_id)
  values ('group', v_title, p_from_profile)
  returning id into v_id;

  insert into conversation_participants (conversation_id, profile_id, user_id, role)
  values (v_id, p_from_profile, v_from_user, 'admin');

  foreach v_member in array v_unique
  loop
    select owner_user_id into v_user from artist_profiles where id = v_member;
    insert into conversation_participants (conversation_id, profile_id, user_id, role)
    values (v_id, v_member, v_user, 'member')
    on conflict (conversation_id, user_id) do nothing;
    perform notify_profile_owner(
      v_member,
      p_from_profile,
      'dm_message',
      coalesce(nullif(trim(v_from_name), ''), 'Someone') || ' added you to ' || v_title,
      'Group chat',
      'conversation',
      v_id,
      '/messages?c=' || v_id::text,
      'dm:' || v_id::text
    );
  end loop;

  return v_id;
end;
$$;

create or replace function add_group_conversation_members(
  p_conversation_id uuid,
  p_from_profile uuid,
  p_member_profile_ids uuid[]
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_from_user uuid;
  v_from_name text;
  v_title text;
  v_member uuid;
  v_user uuid;
  v_added int := 0;
  v_active int;
begin
  if not owns_profile(p_from_profile)
     or not is_artist_group_conversation(p_conversation_id)
     or not is_group_conversation_admin(p_conversation_id) then
    raise exception 'Group unavailable' using errcode = '42501';
  end if;

  select owner_user_id, display_name into v_from_user, v_from_name
  from artist_profiles where id = p_from_profile;
  select title into v_title from conversations where id = p_conversation_id;
  select count(*)::int into v_active
  from conversation_participants
  where conversation_id = p_conversation_id and left_at is null;

  if p_member_profile_ids is null then return 0; end if;

  for v_member in select distinct unnest(p_member_profile_ids)
  loop
    if v_member is null or v_member = p_from_profile then continue; end if;
    if not can_dm_profile(v_member) then
      raise exception 'Cannot message this profile' using errcode = '42501';
    end if;
    select owner_user_id into v_user from artist_profiles where id = v_member;
    if v_user is null or v_user = v_from_user then continue; end if;
    if exists (
      select 1 from conversation_participants
      where conversation_id = p_conversation_id and user_id = v_user and left_at is null
    ) then
      continue;
    end if;
    if v_active >= 20 then
      raise exception 'Groups can have up to 20 people' using errcode = '23514';
    end if;
    insert into conversation_participants (conversation_id, profile_id, user_id, role)
    values (p_conversation_id, v_member, v_user, 'member')
    on conflict (conversation_id, user_id) do update
      set left_at = null, profile_id = excluded.profile_id, role = 'member', joined_at = now()
      where conversation_participants.left_at is not null;
    v_active := v_active + 1;
    v_added := v_added + 1;
    perform notify_profile_owner(
      v_member,
      p_from_profile,
      'dm_message',
      coalesce(nullif(trim(v_from_name), ''), 'Someone') || ' added you to ' || coalesce(v_title, 'a group chat'),
      'Group chat',
      'conversation',
      p_conversation_id,
      '/messages?c=' || p_conversation_id::text,
      'dm:' || p_conversation_id::text
    );
  end loop;

  return v_added;
end;
$$;

create or replace function remove_group_conversation_member(
  p_conversation_id uuid,
  p_profile_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not is_artist_group_conversation(p_conversation_id)
     or not is_group_conversation_admin(p_conversation_id) then
    raise exception 'Group unavailable' using errcode = '42501';
  end if;
  select owner_user_id into v_user from artist_profiles where id = p_profile_id;
  if v_user is null or v_user = auth.uid() then
    raise exception 'Group unavailable' using errcode = '42501';
  end if;
  update conversation_participants
  set left_at = now()
  where conversation_id = p_conversation_id
    and user_id = v_user
    and left_at is null;
end;
$$;

create or replace function leave_group_conversation(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_artist_group_conversation(p_conversation_id)
     or not is_conversation_participant(p_conversation_id) then
    raise exception 'Group unavailable' using errcode = '42501';
  end if;
  update conversation_participants
  set left_at = now()
  where conversation_id = p_conversation_id
    and user_id = auth.uid()
    and left_at is null;
  -- Keep pins possible: if the last admin leaves, the earliest remaining
  -- member becomes admin.
  if not exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and left_at is null and role = 'admin'
  ) then
    update conversation_participants
    set role = 'admin'
    where id = (
      select id from conversation_participants
      where conversation_id = p_conversation_id and left_at is null
      order by joined_at, id
      limit 1
    );
  end if;
end;
$$;

create or replace function rename_group_conversation(
  p_conversation_id uuid,
  p_title text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if not is_artist_group_conversation(p_conversation_id)
     or not is_group_conversation_admin(p_conversation_id) then
    raise exception 'Group unavailable' using errcode = '42501';
  end if;
  v_title := left(trim(coalesce(p_title, '')), 80);
  if char_length(v_title) = 0 then
    raise exception 'Group needs a name' using errcode = '23514';
  end if;
  update conversations set title = v_title where id = p_conversation_id;
end;
$$;

revoke execute on function start_group_conversation(uuid, uuid[], text) from public, anon;
revoke execute on function add_group_conversation_members(uuid, uuid, uuid[]) from public, anon;
revoke execute on function remove_group_conversation_member(uuid, uuid) from public, anon;
revoke execute on function leave_group_conversation(uuid) from public, anon;
revoke execute on function rename_group_conversation(uuid, text) from public, anon;
grant execute on function start_group_conversation(uuid, uuid[], text) to authenticated;
grant execute on function add_group_conversation_members(uuid, uuid, uuid[]) to authenticated;
grant execute on function remove_group_conversation_member(uuid, uuid) to authenticated;
grant execute on function leave_group_conversation(uuid) to authenticated;
grant execute on function rename_group_conversation(uuid, text) to authenticated;

-- Reactions already work in 1:1 threads. Scene chat uses scene_message_reactions.
-- Artist groups (and team rooms) share the same reaction table as DMs.
create or replace function toggle_direct_message_reaction(
  p_message_id uuid, p_profile_id uuid, p_emoji text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_conversation uuid; v_scene uuid;
begin
  select m.conversation_id, c.scene_id into v_conversation, v_scene
  from messages m join conversations c on c.id = m.conversation_id
  where m.id = p_message_id and m.deleted_at is null;
  if v_conversation is null or v_scene is not null
     or not is_conversation_participant(v_conversation)
     or not owns_profile(p_profile_id)
     or char_length(p_emoji) not between 1 and 16 then
    raise exception 'Reaction unavailable' using errcode = '42501';
  end if;
  delete from direct_message_reactions
  where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
  if found then return false; end if;
  insert into direct_message_reactions (
    message_id, conversation_id, user_id, profile_id, emoji
  ) values (p_message_id, v_conversation, auth.uid(), p_profile_id, p_emoji);
  return true;
end;
$$;

insert into schema_migrations(version,name,checksum,applied_by)
values(111,'111_artist_group_chats','initial','migration-self-register')
on conflict(version) do nothing;
