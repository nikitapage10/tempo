-- TEMPO migration 052 — Scenes, part 4: scene events and RSVPs
-- Additive. Depends on 049 and 050.
--
-- Why a parallel table instead of `calendar_events.scene_id`:
-- validate_calendar_event (037) is a security definer validator that hard
-- requires `user_id = auth.uid()` AND a space owned by that same user. It
-- guards every single-user event in the product. Relaxing it would mean
-- editing the guard on a shipped feature to serve a construct it has no shape
-- for — a scene event has a host, many attendees, a capacity and an RSVP
-- deadline, and belongs to no space at all.
--
-- calendar_events_temporal_shape IS reproduced verbatim below, so a Calendar
-- renderer can consume both row shapes with one code path when phase 2 lets a
-- member copy a scene event into their own calendar (via
-- mirror_calendar_event_id, created here so that never needs an ALTER).

create table if not exists scene_events (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  created_by_profile_id uuid not null references artist_profiles(id) on delete cascade,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  title text not null,
  description text,
  location text,
  location_url text,
  kind text not null default 'other'
    check (kind in ('session', 'show', 'listening', 'meeting', 'workshop', 'other')),

  all_day boolean not null default true,
  start_date date,
  end_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,

  capacity int,
  rsvp_deadline timestamptz,
  going_count int not null default 0,
  interested_count int not null default 0,

  -- The feed post that announced this event, so cancelling can reach it.
  announce_post_id uuid references posts(id) on delete set null,
  -- Phase-2 affordance: a member's personal copy in their own calendar.
  mirror_calendar_event_id uuid references calendar_events(id) on delete set null,

  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Verbatim from calendar_events (037), so both shapes stay interchangeable.
  constraint scene_events_temporal_shape check (
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
  constraint scene_events_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint scene_events_description_length check (description is null or char_length(description) <= 4000),
  constraint scene_events_location_length check (location is null or char_length(location) <= 240),
  constraint scene_events_capacity_positive check (capacity is null or capacity > 0)
);

create index if not exists idx_scene_events_scene_date
  on scene_events (scene_id, start_date) where all_day and cancelled_at is null;
create index if not exists idx_scene_events_scene_starts
  on scene_events (scene_id, starts_at) where not all_day and cancelled_at is null;
create index if not exists idx_scene_events_scene_created
  on scene_events (scene_id, created_at desc);

create table if not exists scene_event_rsvps (
  event_id uuid not null references scene_events(id) on delete cascade,
  profile_id uuid not null references artist_profiles(id) on delete cascade,
  scene_id uuid not null references scenes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  response text not null check (response in ('going', 'interested', 'not_going')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id),
  constraint scene_event_rsvps_note_len check (note is null or char_length(note) <= 500)
);

create index if not exists idx_scene_event_rsvps_event
  on scene_event_rsvps (event_id, response);

drop trigger if exists trg_scene_events_updated_at on scene_events;
create trigger trg_scene_events_updated_at before update on scene_events
  for each row execute function touch_scenes_updated_at();

drop trigger if exists trg_scene_event_rsvps_updated_at on scene_event_rsvps;
create trigger trg_scene_event_rsvps_updated_at before update on scene_event_rsvps
  for each row execute function touch_scenes_updated_at();

-- ---------- counters (security definer) ----------
-- An attendee does not own the event row, so a plain trigger's UPDATE would
-- be filtered to zero rows by update_scene_events.

create or replace function bump_scene_event_rsvp_counts() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_event uuid := coalesce(new.event_id, old.event_id);
  v_old text := case when tg_op = 'INSERT' then null else old.response end;
  v_new text := case when tg_op = 'DELETE' then null else new.response end;
begin
  if v_old is not distinct from v_new then return coalesce(new, old); end if;

  update scene_events set
    going_count = greatest(going_count
      + case when v_new = 'going' then 1 else 0 end
      - case when v_old = 'going' then 1 else 0 end, 0),
    interested_count = greatest(interested_count
      + case when v_new = 'interested' then 1 else 0 end
      - case when v_old = 'interested' then 1 else 0 end, 0)
  where id = v_event;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_bump_scene_event_rsvp_counts on scene_event_rsvps;
create trigger trg_bump_scene_event_rsvp_counts
  after insert or update of response or delete on scene_event_rsvps
  for each row execute function bump_scene_event_rsvp_counts();

-- Capacity is enforced here rather than in a check constraint, because it is
-- a race between concurrent RSVPs, not a property of one row.
create or replace function enforce_scene_event_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_going int;
  v_deadline timestamptz;
  v_cancelled timestamptz;
begin
  if new.response <> 'going' then return new; end if;
  if tg_op = 'UPDATE' and old.response = 'going' then return new; end if;

  select capacity, going_count, rsvp_deadline, cancelled_at
  into v_capacity, v_going, v_deadline, v_cancelled
  from scene_events where id = new.event_id for update;

  if v_cancelled is not null then
    raise exception 'That event was cancelled' using errcode = '42501';
  end if;
  if v_deadline is not null and v_deadline <= now() then
    raise exception 'RSVPs have closed for that event' using errcode = '42501';
  end if;
  if v_capacity is not null and v_going >= v_capacity then
    raise exception 'That event is full' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_scene_event_capacity on scene_event_rsvps;
create trigger trg_enforce_scene_event_capacity
  before insert or update of response on scene_event_rsvps
  for each row execute function enforce_scene_event_capacity();

-- ---------- notifications ----------
-- A new event is worth a row per member — events are rare and time-bound,
-- which is exactly the case ordinary posts are not. Muted members are
-- skipped, and the group_key collapses repeated edits into one tray entry.

create or replace function notify_on_scene_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_scene text;
  v_slug text;
begin
  select name, slug into v_scene, v_slug from scenes where id = new.scene_id;

  for r in
    select m.profile_id from scene_members m
    where m.scene_id = new.scene_id
      and m.status = 'active'
      and not m.muted
      and m.profile_id <> new.created_by_profile_id
  loop
    perform notify_profile_owner(
      r.profile_id, new.created_by_profile_id, 'scene_event',
      coalesce(v_scene, 'A scene') || ' added an event',
      left(new.title, 140), 'scene_event', new.id,
      '/scenes/' || v_slug || '?tab=events&event=' || new.id::text,
      'scene_event:' || new.id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_scene_event on scene_events;
create trigger trg_notify_on_scene_event after insert on scene_events
  for each row execute function notify_on_scene_event();

-- ---------- RLS ----------

alter table scene_events enable row level security;
alter table scene_event_rsvps enable row level security;

drop policy if exists select_scene_events on scene_events;
create policy select_scene_events on scene_events for select
  to authenticated using (can_view_scene(scene_id));

-- Phase 1: managers schedule, members attend. Opening this to members is a
-- phase-2 change to this one policy and nothing else.
drop policy if exists insert_scene_events on scene_events;
create policy insert_scene_events on scene_events for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and owns_profile(created_by_profile_id)
    and is_scene_manager(scene_id)
  );

drop policy if exists update_scene_events on scene_events;
create policy update_scene_events on scene_events for update
  to authenticated
  using (created_by_user_id = auth.uid() or is_scene_manager(scene_id))
  with check (created_by_user_id = auth.uid() or is_scene_manager(scene_id));

drop policy if exists delete_scene_events on scene_events;
create policy delete_scene_events on scene_events for delete
  to authenticated using (is_scene_manager(scene_id));

-- The roster is visible to the room — knowing who else is coming is the point.
drop policy if exists select_scene_event_rsvps on scene_event_rsvps;
create policy select_scene_event_rsvps on scene_event_rsvps for select
  to authenticated using (can_view_scene(scene_id));

drop policy if exists insert_scene_event_rsvps on scene_event_rsvps;
create policy insert_scene_event_rsvps on scene_event_rsvps for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and owns_profile(profile_id)
    and is_scene_member(scene_id)
    and exists (
      select 1 from scene_events e
      where e.id = event_id and e.scene_id = scene_event_rsvps.scene_id
    )
  );

drop policy if exists update_scene_event_rsvps on scene_event_rsvps;
create policy update_scene_event_rsvps on scene_event_rsvps for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists delete_scene_event_rsvps on scene_event_rsvps;
create policy delete_scene_event_rsvps on scene_event_rsvps for delete
  to authenticated using (user_id = auth.uid());
