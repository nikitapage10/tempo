-- TEMPO migration 113 — tasks workspace overhaul
-- Adds priority, completion timestamp, reminders, and recurrence to tasks;
-- adds a task_steps checklist table and a task reminder delivery/dedup table
-- mirroring the calendar reminder pattern from migration 038.
-- Additive only. Run manually in the Supabase SQL editor after migration 112.

alter table tasks
  add column if not exists priority smallint not null default 0
    check (priority between 0 and 3),
  add column if not exists completed_at timestamptz,
  add column if not exists reminder_minutes integer[] not null default '{}',
  add column if not exists recurrence text
    check (recurrence in ('daily','weekly','biweekly','monthly')),
  add column if not exists recurrence_until date,
  add column if not exists recurrence_parent_id uuid references tasks(id) on delete set null;

alter table tasks drop constraint if exists tasks_reminders_valid;
alter table tasks add constraint tasks_reminders_valid check (
  reminder_minutes <@ array[0,15,30,60,1440,10080]
);

create index if not exists idx_tasks_space_priority on tasks (space_id, priority desc, due_date);
create index if not exists idx_tasks_recurrence_parent on tasks (recurrence_parent_id) where recurrence_parent_id is not null;

create table if not exists task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 200),
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_steps_task on task_steps (task_id, sort_order);

alter table task_steps enable row level security;

drop policy if exists read_task_steps on task_steps;
create policy read_task_steps on task_steps for select using (
  exists (select 1 from tasks t where t.id = task_id and can_read_space_area(t.space_id, 'tasks'))
);
drop policy if exists write_task_steps on task_steps;
create policy write_task_steps on task_steps for all using (
  exists (select 1 from tasks t where t.id = task_id and can_write_space_area(t.space_id, 'tasks'))
) with check (
  exists (select 1 from tasks t where t.id = task_id and can_write_space_area(t.space_id, 'tasks'))
);

create table if not exists task_reminder_deliveries (
  task_id uuid not null references tasks(id) on delete cascade,
  reminder_minutes integer not null,
  due_at timestamptz not null,
  delivered_at timestamptz not null default now(),
  primary key (task_id, reminder_minutes, due_at)
);
alter table task_reminder_deliveries enable row level security;
drop policy if exists read_task_reminder_deliveries on task_reminder_deliveries;
create policy read_task_reminder_deliveries on task_reminder_deliveries for select using (
  exists (select 1 from tasks t where t.id = task_id and can_read_space_area(t.space_id, 'tasks'))
);

-- Runs server-role only (called from the pulse-dispatch cron), so it scans across
-- all users rather than filtering by auth.uid() like deliver_calendar_reminders().
create or replace function deliver_task_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare delivered integer := 0;
begin
  with due as (
    select t.id, t.assigned_to_user_id, t.user_id, t.title, reminder,
      (t.due_date::timestamp at time zone 'UTC') as due_at
    from tasks t cross join lateral unnest(t.reminder_minutes) reminder
    where t.status <> 'done' and t.due_date is not null
      and (t.due_date::timestamp at time zone 'UTC') - make_interval(mins => reminder) <= now()
      and (t.due_date::timestamp at time zone 'UTC') > now() - interval '1 day'
  ), claimed as (
    insert into task_reminder_deliveries(task_id, reminder_minutes, due_at)
    select id, reminder, due_at from due
    on conflict do nothing returning task_id, reminder_minutes, due_at
  ), notices as (
    insert into notifications(user_id, track_id, type, title, body, link_url, entity_type, entity_id)
    select coalesce(d.assigned_to_user_id, d.user_id), null, 'task_reminder', d.title,
      case when c.reminder_minutes = 0 then 'Due now'
           when c.reminder_minutes < 60 then c.reminder_minutes || ' minutes away'
           when c.reminder_minutes < 1440 then (c.reminder_minutes / 60) || ' hour(s) away'
           else (c.reminder_minutes / 1440) || ' day(s) away' end,
      '/tasks?edit=' || d.id, 'task', d.id
    from claimed c join due d on d.id = c.task_id and d.reminder = c.reminder_minutes and d.due_at = c.due_at
    returning 1
  ) select count(*) into delivered from notices;
  return delivered;
end;
$$;

revoke execute on function deliver_task_reminders() from public, anon;
grant execute on function deliver_task_reminders() to authenticated, service_role;

insert into schema_migrations(version, name, checksum, applied_by)
values (113, '113_tasks_workspace', 'initial', 'migration-self-register')
on conflict(version) do nothing;
