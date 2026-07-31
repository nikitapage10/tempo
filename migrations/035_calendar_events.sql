-- TEMPO migration 035 — native calendar events
-- Additive only. Run manually in the Supabase SQL editor after migration 034.

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  track_id uuid references tracks(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  kind text not null default 'other'
    check (kind in ('studio_session','meeting','content','live_show','personal','other')),
  description text,
  location text,
  all_day boolean not null default true,
  start_date date,
  end_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_one_relation check (num_nonnulls(track_id, project_id) <= 1),
  constraint calendar_events_temporal_shape check (
    (
      all_day and start_date is not null
      and starts_at is null and ends_at is null and timezone is null
      and (end_date is null or end_date >= start_date)
    ) or (
      not all_day and start_date is null and end_date is null
      and starts_at is not null and timezone is not null
      and (ends_at is null or ends_at > starts_at)
    )
  ),
  constraint calendar_events_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint calendar_events_description_length check (description is null or char_length(description) <= 4000),
  constraint calendar_events_location_length check (location is null or char_length(location) <= 240)
);

create index if not exists idx_calendar_events_space_start_date
  on calendar_events (space_id, start_date) where all_day;
create index if not exists idx_calendar_events_space_starts_at
  on calendar_events (space_id, starts_at) where not all_day;
create index if not exists idx_calendar_events_user_created
  on calendar_events (user_id, created_at desc);

create or replace function validate_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_owner uuid;
  v_relation_owner uuid;
  v_relation_space uuid;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'calendar event owner mismatch';
  end if;

  select user_id into v_space_owner from spaces where id = new.space_id;
  if v_space_owner is null or v_space_owner <> new.user_id then
    raise exception 'calendar event space is unavailable';
  end if;

  if new.track_id is not null then
    select user_id, space_id into v_relation_owner, v_relation_space
      from tracks where id = new.track_id;
    if v_relation_owner is null or v_relation_owner <> new.user_id or v_relation_space <> new.space_id then
      raise exception 'calendar event track is unavailable';
    end if;
  end if;

  if new.project_id is not null then
    select user_id, space_id into v_relation_owner, v_relation_space
      from projects where id = new.project_id;
    if v_relation_owner is null or v_relation_owner <> new.user_id or v_relation_space is null or v_relation_space <> new.space_id then
      raise exception 'calendar event project is unavailable';
    end if;
  end if;

  if not new.all_day and not exists (
    select 1 from pg_timezone_names where name = new.timezone
  ) then
    raise exception 'calendar event timezone is invalid';
  end if;

  return new;
end;
$$;

create or replace function touch_calendar_event_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_validate_calendar_event on calendar_events;
create trigger trg_validate_calendar_event
before insert or update on calendar_events
for each row execute function validate_calendar_event();

drop trigger if exists trg_calendar_event_updated_at on calendar_events;
create trigger trg_calendar_event_updated_at
before update on calendar_events
for each row execute function touch_calendar_event_updated_at();

alter table calendar_events enable row level security;

drop policy if exists own_calendar_events_select on calendar_events;
create policy own_calendar_events_select on calendar_events for select
  using (user_id = auth.uid());
drop policy if exists own_calendar_events_insert on calendar_events;
create policy own_calendar_events_insert on calendar_events for insert
  with check (user_id = auth.uid());
drop policy if exists own_calendar_events_update on calendar_events;
create policy own_calendar_events_update on calendar_events for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_calendar_events_delete on calendar_events;
create policy own_calendar_events_delete on calendar_events for delete
  using (user_id = auth.uid());

