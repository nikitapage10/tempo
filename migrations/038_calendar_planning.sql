-- TEMPO migration 038 — expanded creative planning calendar
-- Additive only. Run manually in the Supabase SQL editor after migration 037.

alter table calendar_events
  add column if not exists recurrence text not null default 'none'
    check (recurrence in ('none','daily','weekly','monthly')),
  add column if not exists recurrence_until date,
  add column if not exists reminder_minutes integer[] not null default '{}',
  add column if not exists participants text[] not null default '{}',
  add column if not exists links jsonb not null default '[]'::jsonb,
  add column if not exists attachment_urls text[] not null default '{}',
  add column if not exists milestone_stage text
    check (milestone_stage in ('writing','recording','mixing','mastering','pitching','release')),
  add column if not exists dependency_event_id uuid references calendar_events(id) on delete set null,
  add column if not exists completed_at timestamptz;

alter table calendar_events drop constraint if exists calendar_events_kind_check;
alter table calendar_events add constraint calendar_events_kind_check
  check (kind in ('studio_session','meeting','content','live_show','personal','milestone','other'));

alter table calendar_events drop constraint if exists calendar_events_recurrence_shape;
alter table calendar_events add constraint calendar_events_recurrence_shape check (
  recurrence = 'none' or recurrence_until is null or
  recurrence_until >= coalesce(start_date, (starts_at at time zone coalesce(timezone, 'UTC'))::date)
);
alter table calendar_events drop constraint if exists calendar_events_reminders_valid;
alter table calendar_events add constraint calendar_events_reminders_valid check (
  reminder_minutes <@ array[0,15,30,60,1440,10080]
);
alter table calendar_events drop constraint if exists calendar_events_participants_limit;
alter table calendar_events add constraint calendar_events_participants_limit check (
  cardinality(participants) <= 25
);
alter table calendar_events drop constraint if exists calendar_events_attachments_limit;
alter table calendar_events add constraint calendar_events_attachments_limit check (
  cardinality(attachment_urls) <= 12
);

create table if not exists calendar_event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references calendar_events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists calendar_event_activity (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references calendar_events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_calendar_comments_event on calendar_event_comments(event_id, created_at);
create index if not exists idx_calendar_activity_event on calendar_event_activity(event_id, created_at desc);
create index if not exists idx_calendar_events_dependency on calendar_events(dependency_event_id);

create table if not exists calendar_reminder_deliveries (
  event_id uuid not null references calendar_events(id) on delete cascade,
  reminder_minutes integer not null,
  occurrence_at timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (event_id, reminder_minutes, occurrence_at)
);

alter table calendar_event_comments enable row level security;
alter table calendar_event_activity enable row level security;
alter table calendar_reminder_deliveries enable row level security;

drop policy if exists own_calendar_comments on calendar_event_comments;
create policy own_calendar_comments on calendar_event_comments for all
  using (exists (select 1 from calendar_events e where e.id = event_id and e.user_id = auth.uid()))
  with check (exists (select 1 from calendar_events e where e.id = event_id and e.user_id = auth.uid()));

drop policy if exists own_calendar_activity_select on calendar_event_activity;
create policy own_calendar_activity_select on calendar_event_activity for select
  using (exists (select 1 from calendar_events e where e.id = event_id and e.user_id = auth.uid()));
drop policy if exists own_calendar_activity_insert on calendar_event_activity;
create policy own_calendar_activity_insert on calendar_event_activity for insert
  with check (exists (select 1 from calendar_events e where e.id = event_id and e.user_id = auth.uid()));

drop policy if exists own_calendar_reminder_deliveries on calendar_reminder_deliveries;
create policy own_calendar_reminder_deliveries on calendar_reminder_deliveries for select
  using (user_id = auth.uid());

create or replace function deliver_calendar_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare delivered integer := 0;
begin
  with due as (
    select e.id, e.user_id, e.title, reminder,
      coalesce(e.starts_at, e.start_date::timestamptz) as occurrence_at
    from calendar_events e cross join lateral unnest(e.reminder_minutes) reminder
    where e.user_id = auth.uid() and e.completed_at is null and e.recurrence = 'none'
      and coalesce(e.starts_at, e.start_date::timestamptz) - make_interval(mins => reminder) <= now()
      and coalesce(e.starts_at, e.start_date::timestamptz) > now() - interval '1 day'
  ), claimed as (
    insert into calendar_reminder_deliveries(event_id, reminder_minutes, occurrence_at, user_id)
    select id, reminder, occurrence_at, user_id from due
    on conflict do nothing returning event_id, reminder_minutes, occurrence_at, user_id
  ), notices as (
    insert into notifications(user_id, track_id, type, title, body, link_url, entity_type, entity_id)
    select c.user_id, null, 'calendar_reminder', e.title,
      case when c.reminder_minutes = 0 then 'Starting now'
           when c.reminder_minutes < 60 then c.reminder_minutes || ' minutes away'
           when c.reminder_minutes < 1440 then (c.reminder_minutes / 60) || ' hour(s) away'
           else (c.reminder_minutes / 1440) || ' day(s) away' end,
      '/calendar?event=' || e.id, 'calendar_event', e.id
    from claimed c join calendar_events e on e.id = c.event_id returning 1
  ) select count(*) into delivered from notices;
  return delivered;
end;
$$;

grant execute on function deliver_calendar_reminders() to authenticated;

create or replace function log_calendar_event_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into calendar_event_activity(event_id, user_id, action, summary)
    values (new.id, new.user_id, 'created', 'Created the event');
  elsif tg_op = 'UPDATE' then
    insert into calendar_event_activity(event_id, user_id, action, summary)
    values (new.id, new.user_id, 'updated',
      case when coalesce(new.start_date::text, new.starts_at::text) is distinct from coalesce(old.start_date::text, old.starts_at::text)
        then 'Rescheduled the event' else 'Updated the event' end);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_calendar_event_activity on calendar_events;
create trigger trg_calendar_event_activity after insert or update on calendar_events
for each row execute function log_calendar_event_activity();
