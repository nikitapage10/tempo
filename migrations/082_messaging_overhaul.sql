-- TEMPO migration 082: modern messaging workspace
-- Additive. Run after 081_desktop_vault_and_retention.sql.

-- ---------------------------------------------------------------------------
-- Message lifecycle and history
-- ---------------------------------------------------------------------------

alter table messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null;

alter table support_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists reply_to_message_id uuid references support_messages(id) on delete set null;

alter table conversation_participants
  add column if not exists manually_unread_at timestamptz;

create table if not exists message_revisions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  editor_user_id uuid references auth.users(id) on delete set null,
  revision_kind text not null check (revision_kind in ('edit', 'delete')),
  prior_body text not null default '',
  prior_media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists support_message_revisions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references support_messages(id) on delete cascade,
  editor_user_id uuid references auth.users(id) on delete set null,
  revision_kind text not null check (revision_kind in ('edit', 'delete')),
  prior_body text not null default '',
  prior_media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_revisions_message
  on message_revisions (message_id, created_at desc);
create index if not exists idx_support_message_revisions_message
  on support_message_revisions (message_id, created_at desc);

alter table message_revisions enable row level security;
alter table support_message_revisions enable row level security;
-- Deliberately no authenticated policies. Revision bodies are service/admin only.

create or replace function record_message_revision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into message_revisions (
      message_id, editor_user_id, revision_kind, prior_body, prior_media
    ) values (old.id, auth.uid(), 'delete', old.body, old.media);
  elsif old.body is distinct from new.body then
    insert into message_revisions (
      message_id, editor_user_id, revision_kind, prior_body, prior_media
    ) values (old.id, auth.uid(), 'edit', old.body, old.media);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_message_revision on messages;
create trigger trg_record_message_revision
  before update of body, deleted_at on messages
  for each row execute function record_message_revision();

create or replace function record_support_message_revision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into support_message_revisions (
      message_id, editor_user_id, revision_kind, prior_body, prior_media
    ) values (old.id, coalesce(auth.uid(), new.deleted_by_user_id), 'delete', old.body, old.media);
  elsif old.body is distinct from new.body then
    insert into support_message_revisions (
      message_id, editor_user_id, revision_kind, prior_body, prior_media
    ) values (old.id, coalesce(auth.uid(), new.sender_user_id), 'edit', old.body, old.media);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_support_message_revision on support_messages;
create trigger trg_record_support_message_revision
  before update of body, deleted_at on support_messages
  for each row execute function record_support_message_revision();

create or replace function edit_message(p_message_id uuid, p_body text)
returns messages
language plpgsql security definer set search_path = public as $$
declare v_message messages%rowtype; v_body text;
begin
  v_body := trim(coalesce(p_body, ''));
  if char_length(v_body) > 5000 then
    raise exception 'Message is too long' using errcode = '22001';
  end if;
  select * into v_message from messages where id = p_message_id for update;
  if v_message.id is null or v_message.sender_user_id is distinct from auth.uid()
     or v_message.deleted_at is not null then
    raise exception 'Message unavailable' using errcode = '42501';
  end if;
  if v_body = '' and jsonb_array_length(v_message.media) = 0 then
    raise exception 'A message needs text or an attachment' using errcode = '23514';
  end if;
  update messages set body = v_body, edited_at = now()
  where id = p_message_id returning * into v_message;
  return v_message;
end;
$$;

create or replace function delete_message(p_message_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_message messages%rowtype; v_media jsonb;
begin
  select * into v_message from messages where id = p_message_id for update;
  if v_message.id is null or v_message.sender_user_id is distinct from auth.uid()
     or v_message.deleted_at is not null then
    raise exception 'Message unavailable' using errcode = '42501';
  end if;
  v_media := v_message.media;
  update messages set
    body = '', media = '[]'::jsonb, deleted_at = now(),
    deleted_by_user_id = auth.uid()
  where id = p_message_id;
  return v_media;
end;
$$;

revoke execute on function edit_message(uuid, text) from public, anon;
revoke execute on function delete_message(uuid) from public, anon;
grant execute on function edit_message(uuid, text) to authenticated;
grant execute on function delete_message(uuid) to authenticated;

-- Clients may create messages directly, but all later lifecycle changes pass
-- through the guarded functions above.
drop policy if exists update_messages on messages;
revoke update on messages from authenticated;

-- ---------------------------------------------------------------------------
-- Replies, reactions, and shared pins
-- ---------------------------------------------------------------------------

create table if not exists direct_message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references artist_profiles(id) on delete set null,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists conversation_message_pins (
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  pinned_by_user_id uuid not null references auth.users(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (conversation_id, message_id)
);

create index if not exists idx_direct_message_reactions_conversation
  on direct_message_reactions (conversation_id, message_id);
create index if not exists idx_conversation_message_pins_conversation
  on conversation_message_pins (conversation_id, pinned_at desc);

alter table direct_message_reactions enable row level security;
alter table conversation_message_pins enable row level security;

drop policy if exists view_direct_message_reactions on direct_message_reactions;
create policy view_direct_message_reactions on direct_message_reactions for select
  to authenticated using (is_conversation_participant(conversation_id));

drop policy if exists view_conversation_message_pins on conversation_message_pins;
create policy view_conversation_message_pins on conversation_message_pins for select
  to authenticated using (is_conversation_participant(conversation_id));

create or replace function toggle_direct_message_reaction(
  p_message_id uuid, p_profile_id uuid, p_emoji text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_conversation uuid; v_kind text;
begin
  select m.conversation_id, c.kind into v_conversation, v_kind
  from messages m join conversations c on c.id = m.conversation_id
  where m.id = p_message_id and m.deleted_at is null;
  if v_conversation is null or v_kind <> 'direct'
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

create or replace function toggle_conversation_message_pin(p_message_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_conversation uuid; v_kind text; v_role text;
begin
  select m.conversation_id, c.kind into v_conversation, v_kind
  from messages m join conversations c on c.id = m.conversation_id
  where m.id = p_message_id and m.deleted_at is null;
  select role into v_role from conversation_participants
  where conversation_id = v_conversation and user_id = auth.uid() and left_at is null;
  if v_conversation is null or v_role is null
     or (v_kind = 'group' and v_role <> 'admin') then
    raise exception 'Pin unavailable' using errcode = '42501';
  end if;
  delete from conversation_message_pins
  where conversation_id = v_conversation and message_id = p_message_id;
  if found then return false; end if;
  insert into conversation_message_pins (
    conversation_id, message_id, pinned_by_user_id
  ) values (v_conversation, p_message_id, auth.uid());
  return true;
end;
$$;

revoke execute on function toggle_direct_message_reaction(uuid, uuid, text) from public, anon;
revoke execute on function toggle_conversation_message_pin(uuid) from public, anon;
grant execute on function toggle_direct_message_reaction(uuid, uuid, text) to authenticated;
grant execute on function toggle_conversation_message_pin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Search and inbox state
-- ---------------------------------------------------------------------------

create index if not exists idx_messages_conversation_cursor
  on messages (conversation_id, created_at desc, id desc);
create index if not exists idx_support_messages_report_cursor
  on support_messages (report_id, created_at desc, id desc);
create index if not exists idx_messages_search_body
  on messages using gin (to_tsvector('simple', coalesce(body, '') || ' ' || coalesce(media::text, '')));
create index if not exists idx_support_messages_search_body
  on support_messages using gin (to_tsvector('simple', coalesce(body, '') || ' ' || coalesce(media::text, '')));

create or replace function search_conversation_messages(
  p_conversation_id uuid, p_query text, p_limit integer default 50
) returns setof messages
language sql stable security definer set search_path = public as $$
  select m.* from messages m
  where m.conversation_id = p_conversation_id
    and is_conversation_participant(p_conversation_id)
    and m.deleted_at is null
    and to_tsvector('simple', coalesce(m.body, '') || ' ' || coalesce(m.media::text, ''))
      @@ websearch_to_tsquery('simple', left(trim(p_query), 200))
  order by m.created_at desc, m.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function search_support_messages(
  p_report_id uuid, p_query text, p_limit integer default 50
) returns setof support_messages
language sql stable security definer set search_path = public as $$
  select sm.* from support_messages sm
  where sm.report_id = p_report_id
    and (
      exists (select 1 from support_reports sr where sr.id = p_report_id and sr.user_id = auth.uid())
      or is_platform_admin(auth.uid())
    )
    and sm.deleted_at is null
    and to_tsvector('simple', coalesce(sm.body, '') || ' ' || coalesce(sm.media::text, ''))
      @@ websearch_to_tsquery('simple', left(trim(p_query), 200))
  order by sm.created_at desc, sm.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function set_conversation_muted(p_conversation_id uuid, p_muted boolean)
returns void language sql security definer set search_path = public as $$
  update conversation_participants set muted = p_muted
  where conversation_id = p_conversation_id and user_id = auth.uid() and left_at is null;
$$;

create or replace function mark_conversation_unread(p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  update conversation_participants set manually_unread_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid() and left_at is null;
$$;

revoke execute on function search_conversation_messages(uuid, text, integer) from public, anon;
revoke execute on function search_support_messages(uuid, text, integer) from public, anon;
revoke execute on function set_conversation_muted(uuid, boolean) from public, anon;
revoke execute on function mark_conversation_unread(uuid) from public, anon;
grant execute on function search_conversation_messages(uuid, text, integer) to authenticated;
grant execute on function search_support_messages(uuid, text, integer) to authenticated;
grant execute on function set_conversation_muted(uuid, boolean) to authenticated;
grant execute on function mark_conversation_unread(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Conversation previews and private realtime broadcast
-- ---------------------------------------------------------------------------

create or replace function refresh_conversation_after_message_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare latest messages%rowtype; v_conversation uuid;
begin
  v_conversation := coalesce(new.conversation_id, old.conversation_id);
  select * into latest from messages
  where conversation_id = v_conversation
  order by created_at desc, id desc limit 1;
  update conversations set
    last_message_at = latest.created_at,
    last_message_preview = case
      when latest.id is null then null
      when latest.deleted_at is not null then 'Deleted message'
      else left(coalesce(nullif(trim(latest.body), ''), 'Sent an attachment'), 140)
    end
  where id = v_conversation;
  perform realtime.send(
    jsonb_build_object('operation', tg_op, 'message_id', coalesce(new.id, old.id)),
    'message-change', 'conversation:' || v_conversation::text, true
  );
  return new;
end;
$$;

drop trigger if exists trg_refresh_direct_conversation_after_delete on messages;
drop trigger if exists trg_messaging_realtime on messages;
create trigger trg_messaging_realtime
  after insert or update of body, edited_at, deleted_at on messages
  for each row execute function refresh_conversation_after_message_change();

create or replace function broadcast_conversation_aux_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_conversation uuid;
begin
  v_conversation := coalesce(new.conversation_id, old.conversation_id);
  perform realtime.send(
    jsonb_build_object('operation', tg_op),
    'message-change', 'conversation:' || v_conversation::text, true
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_direct_reaction_realtime on direct_message_reactions;
create trigger trg_direct_reaction_realtime after insert or delete on direct_message_reactions
  for each row execute function broadcast_conversation_aux_change();
drop trigger if exists trg_pin_realtime on conversation_message_pins;
create trigger trg_pin_realtime after insert or delete on conversation_message_pins
  for each row execute function broadcast_conversation_aux_change();

create or replace function broadcast_scene_reaction_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_conversation uuid; v_message uuid;
begin
  v_message := coalesce(new.message_id, old.message_id);
  select conversation_id into v_conversation from messages where id = v_message;
  if v_conversation is not null then
    perform realtime.send(
      jsonb_build_object('operation', tg_op, 'message_id', v_message),
      'message-change', 'conversation:' || v_conversation::text, true
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_scene_reaction_messaging_realtime on scene_message_reactions;
create trigger trg_scene_reaction_messaging_realtime after insert or delete on scene_message_reactions
  for each row execute function broadcast_scene_reaction_change();

create or replace function broadcast_support_message_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_report uuid;
begin
  v_report := coalesce(new.report_id, old.report_id);
  perform realtime.send(
    jsonb_build_object('operation', tg_op, 'message_id', coalesce(new.id, old.id)),
    'message-change', 'support:' || v_report::text, true
  );
  return new;
end;
$$;

drop trigger if exists trg_support_message_realtime on support_messages;
create trigger trg_support_message_realtime
  after insert or update of body, edited_at, deleted_at on support_messages
  for each row execute function broadcast_support_message_change();

create or replace function can_access_messaging_realtime_topic(p_topic text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_id uuid;
begin
  begin
    v_id := split_part(p_topic, ':', 2)::uuid;
  exception when others then
    return false;
  end;
  if p_topic like 'conversation:%' then
    return exists (
      select 1 from conversation_participants
      where conversation_id = v_id and user_id = auth.uid() and left_at is null
    );
  end if;
  if p_topic like 'support:%' then
    return exists (select 1 from support_reports where id = v_id and user_id = auth.uid())
      or is_platform_admin(auth.uid());
  end if;
  return false;
end;
$$;

revoke execute on function can_access_messaging_realtime_topic(text) from public, anon;
grant execute on function can_access_messaging_realtime_topic(text) to authenticated;

drop policy if exists tempo_messaging_realtime_read on realtime.messages;
create policy tempo_messaging_realtime_read on realtime.messages for select
  to authenticated
  using (
    extension = 'broadcast'
    and can_access_messaging_realtime_topic(realtime.topic())
  );

drop policy if exists tempo_messaging_realtime_send on realtime.messages;
create policy tempo_messaging_realtime_send on realtime.messages for insert
  to authenticated
  with check (
    extension = 'broadcast'
    and can_access_messaging_realtime_topic(realtime.topic())
  );
