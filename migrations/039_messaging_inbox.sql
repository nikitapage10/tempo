-- TEMPO migration 039 — full messaging inbox
-- Additive only. Run after 036_support_conversations.sql.

alter table conversation_participants
  add column if not exists archived_at timestamptz;

alter table support_reports
  add column if not exists member_archived_at timestamptz,
  add column if not exists admin_archived_at timestamptz,
  add column if not exists member_last_read_at timestamptz,
  add column if not exists admin_last_read_at timestamptz;

alter table support_messages
  add column if not exists media jsonb not null default '[]'::jsonb,
  add column if not exists deleted_at timestamptz;

alter table support_messages
  alter column body set default '',
  alter column body drop not null;

-- Dropped first so re-running this file is a no-op rather than an error:
-- `add constraint` has no `if not exists` form.
alter table support_messages
  drop constraint if exists support_messages_body_check,
  drop constraint if exists support_messages_media_len,
  drop constraint if exists support_messages_body_or_media;

alter table support_messages
  add constraint support_messages_media_len
    check (jsonb_array_length(media) <= 4),
  add constraint support_messages_body_or_media
    check (
      deleted_at is not null
      or char_length(trim(coalesce(body, ''))) > 0
      or jsonb_array_length(media) > 0
    );

create index if not exists idx_conversation_participants_inbox
  on conversation_participants (user_id, archived_at, conversation_id)
  where left_at is null;

create index if not exists idx_support_reports_member_inbox
  on support_reports (user_id, member_archived_at, last_message_at desc);

create index if not exists idx_support_reports_admin_inbox
  on support_reports (admin_archived_at, last_message_at desc);

-- A fresh reply returns an archived conversation to the recipient's inbox.
create or replace function unarchive_direct_conversation_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversation_participants
  set archived_at = null
  where conversation_id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_unarchive_direct_conversation on messages;
create trigger trg_unarchive_direct_conversation
  after insert on messages
  for each row execute function unarchive_direct_conversation_on_message();

create or replace function refresh_direct_conversation_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  latest messages%rowtype;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    select * into latest from messages
    where conversation_id = new.conversation_id and deleted_at is null
    order by created_at desc limit 1;
    update conversations set
      last_message_at = latest.created_at,
      last_message_preview = case when latest.id is null then null else left(coalesce(nullif(trim(latest.body), ''), 'Sent an attachment'), 140) end
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_direct_conversation_after_delete on messages;
create trigger trg_refresh_direct_conversation_after_delete
  after update of deleted_at on messages
  for each row execute function refresh_direct_conversation_after_delete();

create or replace function touch_support_report_from_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update support_reports
  set
    last_message_at = new.created_at,
    last_admin_reply_at = case when new.sender_role = 'support' then new.created_at else last_admin_reply_at end,
    updated_at = new.created_at,
    status = case
      when new.sender_role = 'member' and status = 'resolved' then 'open'
      when new.sender_role = 'support' and status = 'open' then 'in_progress'
      else status
    end,
    resolved_at = case when new.sender_role = 'member' then null else resolved_at end,
    resolved_by = case when new.sender_role = 'member' then null else resolved_by end,
    member_archived_at = case when new.sender_role = 'support' then null else member_archived_at end,
    admin_archived_at = case when new.sender_role = 'member' then null else admin_archived_at end
  where id = new.report_id;
  return new;
end;
$$;
