-- TEMPO migration 112: expand a 1:1 artist chat into a new group
-- Additive. Depends on 111 (artist group chats) and 058 (suppress_notification).
--
-- Adding someone to a direct message never mutates that thread. It starts a
-- new group with the original two people plus the invitee. History is copied
-- only when asked, with notifications suppressed so old messages do not ping.

create or replace function expand_direct_conversation_to_group(
  p_from_profile uuid,
  p_conversation_id uuid,
  p_member_profile_id uuid,
  p_include_history boolean default false,
  p_title text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_from_user uuid;
  v_from_name text;
  v_kind text;
  v_peer uuid;
  v_peer_user uuid;
  v_peer_name text;
  v_member_user uuid;
  v_member_name text;
  v_title text;
  v_id uuid;
  v_old messages%rowtype;
  v_new_id uuid;
  v_map jsonb := '{}'::jsonb;
  v_reply uuid;
begin
  if not owns_profile(p_from_profile) then
    raise exception 'Not your profile' using errcode = '42501';
  end if;

  select owner_user_id, display_name into v_from_user, v_from_name
  from artist_profiles where id = p_from_profile;
  if v_from_user is null or v_from_user is distinct from auth.uid() then
    raise exception 'Not your profile' using errcode = '42501';
  end if;

  select kind into v_kind from conversations where id = p_conversation_id;
  if v_kind is distinct from 'direct' then
    raise exception 'Only a 1:1 chat can become a group this way' using errcode = '23514';
  end if;

  if not exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
      and left_at is null
  ) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  if exists (
    select 1 from artist_team_rooms where conversation_id = p_conversation_id
  ) then
    raise exception 'Team rooms stay on Teams' using errcode = '23514';
  end if;

  select profile_id, user_id into v_peer, v_peer_user
  from conversation_participants
  where conversation_id = p_conversation_id
    and user_id is distinct from auth.uid()
    and left_at is null
  limit 1;
  if v_peer is null then
    raise exception 'No one else in this chat' using errcode = '23514';
  end if;

  if p_member_profile_id is null
     or p_member_profile_id = p_from_profile
     or p_member_profile_id = v_peer then
    raise exception 'Pick someone who is not already in this chat' using errcode = '23514';
  end if;

  if not can_dm_profile(p_member_profile_id) then
    raise exception 'Cannot message this profile' using errcode = '42501';
  end if;

  select owner_user_id, display_name into v_member_user, v_member_name
  from artist_profiles where id = p_member_profile_id;
  if v_member_user is null or v_member_user = v_from_user or v_member_user = v_peer_user then
    raise exception 'Pick someone who is not already in this chat' using errcode = '23514';
  end if;

  select display_name into v_peer_name from artist_profiles where id = v_peer;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then
    v_title := left(
      concat_ws(', ',
        coalesce(nullif(trim(v_peer_name), ''), 'Artist'),
        coalesce(nullif(trim(v_member_name), ''), 'Artist')
      ),
      80
    );
  end if;
  if v_title is null or char_length(trim(v_title)) = 0 then
    v_title := 'Group chat';
  end if;

  insert into conversations (kind, title, created_by_profile_id)
  values ('group', v_title, p_from_profile)
  returning id into v_id;

  insert into conversation_participants (conversation_id, profile_id, user_id, role)
  values
    (v_id, p_from_profile, v_from_user, 'admin'),
    (v_id, v_peer, v_peer_user, 'member'),
    (v_id, p_member_profile_id, v_member_user, 'member')
  on conflict (conversation_id, user_id) do nothing;

  perform notify_profile_owner(
    v_peer,
    p_from_profile,
    'dm_message',
    coalesce(nullif(trim(v_from_name), ''), 'Someone') || ' started a group from your chat',
    v_title,
    'conversation',
    v_id,
    '/messages?c=' || v_id::text,
    'dm:' || v_id::text
  );
  perform notify_profile_owner(
    p_member_profile_id,
    p_from_profile,
    'dm_message',
    coalesce(nullif(trim(v_from_name), ''), 'Someone') || ' added you to ' || v_title,
    'Group chat',
    'conversation',
    v_id,
    '/messages?c=' || v_id::text,
    'dm:' || v_id::text
  );

  if coalesce(p_include_history, false) then
    for v_old in
      select * from (
        select * from messages
        where conversation_id = p_conversation_id
        order by created_at desc, id desc
        limit 1000
      ) recent
      order by created_at asc, id asc
    loop
      v_new_id := gen_random_uuid();
      v_reply := null;
      if v_old.reply_to_message_id is not null then
        v_reply := nullif(v_map ->> v_old.reply_to_message_id::text, '')::uuid;
      end if;
      insert into messages (
        id,
        conversation_id,
        sender_profile_id,
        sender_user_id,
        sender_scene_persona_id,
        body,
        media,
        reply_to_message_id,
        edited_at,
        deleted_at,
        deleted_by_user_id,
        suppress_notification,
        created_at
      ) values (
        v_new_id,
        v_id,
        v_old.sender_profile_id,
        v_old.sender_user_id,
        null,
        v_old.body,
        v_old.media,
        v_reply,
        v_old.edited_at,
        v_old.deleted_at,
        v_old.deleted_by_user_id,
        true,
        v_old.created_at
      );
      v_map := v_map || jsonb_build_object(v_old.id::text, v_new_id::text);
    end loop;
  end if;

  return v_id;
end;
$$;

revoke execute on function expand_direct_conversation_to_group(uuid, uuid, uuid, boolean, text) from public, anon;
grant execute on function expand_direct_conversation_to_group(uuid, uuid, uuid, boolean, text) to authenticated;
