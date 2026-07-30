-- TEMPO migration 031 — direct messaging
-- Additive only. Depends on 028–030 (profiles, follows/blocks, connections view).
--
-- Hard requirement: conversation_participants RLS must NOT query itself —
-- that raises 42P17 infinite recursion. Always go through
-- is_conversation_participant(uuid).

-- ========== conversations ==========

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  -- Sorted pair of profile ids joined by ':' — exactly one direct thread per pair.
  direct_key text unique,
  title text,
  created_by_profile_id uuid not null references artist_profiles(id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  constraint conversations_direct_key_shape check (
    (kind = 'direct' and direct_key is not null)
    or (kind = 'group' and direct_key is null)
  ),
  constraint conversations_group_title check (
    kind = 'direct' or (title is not null and char_length(trim(title)) > 0)
  )
);

create index if not exists idx_conversations_last_message
  on conversations (last_message_at desc nulls last);

create table if not exists conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  profile_id uuid not null references artist_profiles(id) on delete cascade,
  -- Denormalized so unread counts don't need to join artist_profiles.
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  last_read_at timestamptz,
  muted boolean not null default false,
  left_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create index if not exists idx_conv_participants_user
  on conversation_participants (user_id, conversation_id)
  where left_at is null;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_profile_id uuid not null references artist_profiles(id) on delete cascade,
  sender_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null default '',
  media jsonb not null default '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_body_len check (char_length(body) <= 5000),
  constraint messages_media_len check (jsonb_array_length(media) <= 4),
  constraint messages_body_or_media check (
    deleted_at is not null
    or char_length(trim(body)) > 0
    or jsonb_array_length(media) > 0
  )
);

create index if not exists idx_messages_conversation
  on messages (conversation_id, created_at desc) where deleted_at is null;

-- ========== helpers ==========

-- Avoid 42P17: never query conversation_participants from inside its own policy.
create or replace function is_conversation_participant(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
      and cp.left_at is null
  );
$$;

revoke execute on function is_conversation_participant(uuid) from public, anon;
grant execute on function is_conversation_participant(uuid) to authenticated;

-- Can the caller's profile DM this target?
-- Reads profile_connections from inside a definer function, where RLS on
-- profile_follows is bypassed by design. profile_connections must therefore
-- never gain a column carrying private data, since any definer function can
-- read it unfiltered.
create or replace function can_dm_profile(p_target_profile_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_policy text;
  v_my uuid;
begin
  if p_target_profile_id is null then return false; end if;
  if owns_profile(p_target_profile_id) then return false; end if;

  -- Block either direction kills DMs.
  if exists (
    select 1 from my_profile_ids() mid
    where is_blocked_between(mid, p_target_profile_id)
  ) then
    return false;
  end if;

  select accepts_dms into v_policy
  from artist_profiles where id = p_target_profile_id;
  if v_policy is null then return false; end if;
  if v_policy = 'nobody' then return false; end if;
  if v_policy = 'anyone' then return true; end if;

  -- 'connections' = mutual follow
  select mid into v_my from my_profile_ids() mid limit 1;
  if v_my is null then return false; end if;

  return exists (
    select 1 from profile_connections c
    where (c.profile_a_id = v_my and c.profile_b_id = p_target_profile_id)
       or (c.profile_b_id = v_my and c.profile_a_id = p_target_profile_id)
  );
end;
$$;

revoke execute on function can_dm_profile(uuid) from public, anon;
grant execute on function can_dm_profile(uuid) to authenticated;

create or replace function make_direct_key(p_a uuid, p_b uuid) returns text
language sql immutable as $$
  select case
    when p_a::text < p_b::text then p_a::text || ':' || p_b::text
    else p_b::text || ':' || p_a::text
  end;
$$;

-- Opening a DM is two inserts with a uniqueness race on direct_key.
create or replace function start_direct_conversation(
  p_from_profile uuid,
  p_to_profile uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_key text;
  v_id uuid;
  v_from_user uuid;
  v_to_user uuid;
begin
  if not owns_profile(p_from_profile) then
    raise exception 'Not your profile' using errcode = '42501';
  end if;
  if not can_dm_profile(p_to_profile) then
    raise exception 'Cannot message this profile' using errcode = '42501';
  end if;

  v_key := make_direct_key(p_from_profile, p_to_profile);

  select id into v_id from conversations where direct_key = v_key;
  if v_id is not null then
    -- Re-join if the caller previously left.
    update conversation_participants
    set left_at = null, joined_at = coalesce(joined_at, now())
    where conversation_id = v_id
      and profile_id = p_from_profile
      and left_at is not null;
    return v_id;
  end if;

  select owner_user_id into v_from_user from artist_profiles where id = p_from_profile;
  select owner_user_id into v_to_user from artist_profiles where id = p_to_profile;

  insert into conversations (kind, direct_key, created_by_profile_id)
  values ('direct', v_key, p_from_profile)
  on conflict (direct_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from conversations where direct_key = v_key;
  end if;

  insert into conversation_participants (conversation_id, profile_id, user_id, role)
  values
    (v_id, p_from_profile, v_from_user, 'member'),
    (v_id, p_to_profile, v_to_user, 'member')
  on conflict do nothing;

  return v_id;
end;
$$;

revoke execute on function start_direct_conversation(uuid, uuid) from public, anon;
grant execute on function start_direct_conversation(uuid, uuid) to authenticated;

-- Keep last_message_* fresh; notify the other participant(s).
create or replace function on_message_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_preview text;
  v_actor_name text;
begin
  v_preview := left(coalesce(nullif(trim(new.body), ''), 'Sent an attachment'), 140);
  update conversations set
    last_message_at = new.created_at,
    last_message_preview = v_preview
  where id = new.conversation_id;

  select display_name into v_actor_name from artist_profiles where id = new.sender_profile_id;

  for r in
    select cp.profile_id
    from conversation_participants cp
    where cp.conversation_id = new.conversation_id
      and cp.left_at is null
      and cp.profile_id <> new.sender_profile_id
      and not cp.muted
  loop
    perform notify_profile_owner(
      r.profile_id,
      new.sender_profile_id,
      'dm_message',
      coalesce(v_actor_name, 'Someone') || ' sent you a message',
      v_preview,
      'conversation',
      new.conversation_id,
      '/messages?c=' || new.conversation_id::text,
      'dm:' || new.conversation_id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_on_message_inserted on messages;
create trigger trg_on_message_inserted after insert on messages
  for each row execute function on_message_inserted();

-- ========== RLS ==========

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;

drop policy if exists select_conversations on conversations;
create policy select_conversations on conversations for select
  to authenticated
  using (is_conversation_participant(id));

drop policy if exists insert_conversations on conversations;
create policy insert_conversations on conversations for insert
  to authenticated
  with check (owns_profile(created_by_profile_id));

drop policy if exists update_conversations on conversations;
create policy update_conversations on conversations for update
  to authenticated
  using (is_conversation_participant(id))
  with check (is_conversation_participant(id));

-- Participants: ALWAYS via is_conversation_participant — never self-query.
drop policy if exists select_conversation_participants on conversation_participants;
create policy select_conversation_participants on conversation_participants for select
  to authenticated
  using (is_conversation_participant(conversation_id) or user_id = auth.uid());

drop policy if exists insert_conversation_participants on conversation_participants;
create policy insert_conversation_participants on conversation_participants for insert
  to authenticated
  with check (
    -- Allowed via start_direct_conversation (definer) or group admin paths later.
    owns_profile(profile_id)
    or is_conversation_participant(conversation_id)
  );

drop policy if exists update_conversation_participants on conversation_participants;
create policy update_conversation_participants on conversation_participants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists select_messages on messages;
create policy select_messages on messages for select
  to authenticated
  using (is_conversation_participant(conversation_id));

drop policy if exists insert_messages on messages;
create policy insert_messages on messages for insert
  to authenticated
  with check (
    sender_user_id = auth.uid()
    and owns_profile(sender_profile_id)
    and is_conversation_participant(conversation_id)
  );

drop policy if exists update_messages on messages;
create policy update_messages on messages for update
  to authenticated
  using (sender_user_id = auth.uid())
  with check (sender_user_id = auth.uid());
