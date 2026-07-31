-- TEMPO migration 036 — two-way support conversations
-- Additive only. Run manually in the Supabase SQL editor after 035_support_reports.sql.

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references support_reports(id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'support')),
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_messages_thread
  on support_messages (report_id, created_at asc);

alter table support_messages enable row level security;

-- Deliberately no browser-facing policies. Authenticated support APIs verify
-- report ownership before using the server-only service client. Admin routes
-- are separately protected by requireAdmin().

alter table support_reports
  add column if not exists last_message_at timestamptz,
  add column if not exists last_admin_reply_at timestamptz;

update support_reports
set last_message_at = created_at
where last_message_at is null;

create or replace function touch_support_report_from_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update support_reports
  set
    last_message_at = new.created_at,
    last_admin_reply_at = case
      when new.sender_role = 'support' then new.created_at
      else last_admin_reply_at
    end,
    updated_at = new.created_at,
    status = case
      when new.sender_role = 'member' and status = 'resolved' then 'open'
      when new.sender_role = 'support' and status = 'open' then 'in_progress'
      else status
    end,
    resolved_at = case
      when new.sender_role = 'member' then null
      else resolved_at
    end,
    resolved_by = case
      when new.sender_role = 'member' then null
      else resolved_by
    end
  where id = new.report_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_support_report_from_message on support_messages;
create trigger trg_touch_support_report_from_message
  after insert on support_messages
  for each row execute function touch_support_report_from_message();
