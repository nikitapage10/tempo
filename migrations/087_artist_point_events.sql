-- TEMPO migration 087 — artist point ledger + award triggers (gamification, part 2)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- Mirrors the shape scene_point_events already uses at community scope
-- (migration 065: rule_key, points, idempotency_key) at artist scope instead.
-- The two stay disjoint on purpose — scene points are community reputation,
-- artist points are craft progress — and this table is never summed with
-- that one.
--
-- Every scoreable action writes exactly one row here. That is what makes a
-- points system defensible in a codebase that otherwise refuses opaque
-- composite scores (see lib/attention/signals.ts, lib/artist-stats.ts): "why
-- is my Output 62" is always answerable as a list of real rows, not a guess.
-- Point *amounts* are set here in SQL because triggers must be SQL, but they
-- are mirrored as documented constants in lib/gamification/rules.ts, which is
-- the file to read to understand the whole economy at a glance — if you
-- change a value in one place, change it in the other.

create table if not exists artist_point_events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_key text not null,
  attribute text not null check (attribute in (
    'output', 'velocity', 'follow_through', 'consistency', 'stage_presence', 'reach'
  )),
  points int not null check (points between -500 and 500),
  subject_type text,
  subject_id uuid,
  occurred_at timestamptz not null default now(),
  -- The same real-world event can never score twice, whether it fires live
  -- or is replayed by the backfill routine.
  idempotency_key text not null,
  source text not null default 'trigger' check (source in ('trigger', 'backfill', 'server')),
  created_at timestamptz not null default now(),
  unique (artist_id, idempotency_key)
);

create index if not exists idx_artist_point_events_artist_time
  on artist_point_events (artist_id, occurred_at desc);
create index if not exists idx_artist_point_events_artist_attr_time
  on artist_point_events (artist_id, attribute, occurred_at desc);
create index if not exists idx_artist_point_events_rule_user_day
  on artist_point_events (user_id, rule_key, occurred_at desc);

alter table artist_point_events enable row level security;

-- Read-only to clients, same reasoning as stage_transitions: only
-- security-definer triggers (and, later, the backfill/evaluate server
-- routes using the service-role client) may write here.
drop policy if exists own_artist_point_events_select on artist_point_events;
create policy own_artist_point_events_select on artist_point_events
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Shared helper: insert one point event, silently no-op on a duplicate
-- idempotency key or an unenforceable daily cap. Returns void so triggers can
-- call it and move on regardless of outcome.
-- ---------------------------------------------------------------------------
create or replace function award_artist_points(
  p_artist_id uuid,
  p_user_id uuid,
  p_rule_key text,
  p_attribute text,
  p_points int,
  p_subject_type text,
  p_subject_id uuid,
  p_occurred_at timestamptz,
  p_idempotency_key text,
  p_source text,
  p_daily_cap int default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_today_count int;
begin
  if p_daily_cap is not null then
    select count(*) into v_today_count
      from artist_point_events
     where user_id = p_user_id
       and rule_key = p_rule_key
       and occurred_at >= date_trunc('day', p_occurred_at)
       and occurred_at < date_trunc('day', p_occurred_at) + interval '1 day';
    if v_today_count >= p_daily_cap then
      return;
    end if;
  end if;

  insert into artist_point_events (
    artist_id, user_id, rule_key, attribute, points,
    subject_type, subject_id, occurred_at, idempotency_key, source)
  values (
    p_artist_id, p_user_id, p_rule_key, p_attribute, p_points,
    p_subject_type, p_subject_id, p_occurred_at, p_idempotency_key, p_source)
  on conflict (artist_id, idempotency_key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rule 1 — a bounce uploaded. +4 output, +20 more if it's a master.
-- Daily cap of 12 bounces so re-uploading the same idea all afternoon can't
-- be farmed; a real day of finishing work never approaches that.
-- ---------------------------------------------------------------------------
create or replace function award_points_for_version() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_artist_id uuid;
  v_user_id uuid;
begin
  select s.artist_id, t.user_id into v_artist_id, v_user_id
    from tracks t join spaces s on s.id = t.space_id
   where t.id = new.track_id;

  if v_artist_id is null then
    return null;
  end if;

  perform award_artist_points(
    v_artist_id, v_user_id, 'bounce_uploaded', 'output', 4,
    'version', new.id, new.created_at,
    'version:' || new.id::text, 'trigger', 12);

  if new.milestone_type = 'master' then
    perform award_artist_points(
      v_artist_id, v_user_id, 'master_uploaded', 'output', 20,
      'version', new.id, new.created_at,
      'version-master:' || new.id::text, 'trigger', null);
  end if;

  return null;
end;
$$;

drop trigger if exists trg_award_points_for_version on versions;
create trigger trg_award_points_for_version
  after insert on versions
  for each row execute function award_points_for_version();

-- ---------------------------------------------------------------------------
-- Rule 2 — a forward stage move. +6 velocity, more for a fast one: dwell
-- under a day scores double, under a week scores 1.5x. Only ever fires once
-- per (track, from-stage, to-stage) pair, ever — dragging a card back and
-- forth cannot inflate this. Backward/lateral moves and backfilled rows are
-- never scored.
--
-- The same event also carries the one follow-through bonus that's a true
-- discrete write rather than a time-based condition: reaching a space's
-- terminal (highest-sort) stage for the first time. The matching penalty for
-- a track that stalls (a *duration*, not an event) can't be a trigger — it's
-- reconciled server-side; see lib/gamification/evaluate.ts.
-- ---------------------------------------------------------------------------
create or replace function award_points_for_stage_transition() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_artist_id uuid;
  v_dwell_hours numeric;
  v_points int := 6;
  v_max_sort int;
begin
  if new.source <> 'trigger' or new.direction <> 1 or new.from_stage_id is null then
    return null;
  end if;

  select artist_id into v_artist_id from spaces where id = new.space_id;
  if v_artist_id is null then
    return null;
  end if;

  select extract(epoch from (new.entered_at - prior.entered_at)) / 3600.0
    into v_dwell_hours
    from stage_transitions prior
   where prior.track_id = new.track_id
     and prior.to_stage_id = new.from_stage_id
     and prior.entered_at < new.entered_at
   order by prior.entered_at desc
   limit 1;

  if v_dwell_hours is not null then
    if v_dwell_hours <= 24 then
      v_points := 12;
    elsif v_dwell_hours <= 168 then
      v_points := 9;
    end if;
  end if;

  perform award_artist_points(
    v_artist_id, new.user_id, 'stage_advanced', 'velocity', v_points,
    'track', new.track_id, new.entered_at,
    'stage:' || new.track_id::text || ':' || coalesce(new.from_stage_id::text, 'none')
      || ':' || coalesce(new.to_stage_id::text, 'none'),
    'trigger', null);

  select max(sort) into v_max_sort from stages where space_id = new.space_id;
  if v_max_sort is not null and new.to_sort = v_max_sort then
    perform award_artist_points(
      v_artist_id, new.user_id, 'track_finished', 'follow_through', 15,
      'track', new.track_id, new.entered_at,
      'finished:' || new.track_id::text, 'trigger', null);
  end if;

  return null;
end;
$$;

drop trigger if exists trg_award_points_for_stage_transition on stage_transitions;
create trigger trg_award_points_for_stage_transition
  after insert on stage_transitions
  for each row execute function award_points_for_stage_transition();

-- ---------------------------------------------------------------------------
-- Rule 3 — a focus session completed. +3 consistency, capped at 6 a day (a
-- long day of real sessions is never punished; running the timer forty times
-- for the same effect is).
-- ---------------------------------------------------------------------------
create or replace function award_points_for_session() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_artist_id uuid;
begin
  if new.status <> 'completed' then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then
    return null;
  end if;

  select s.artist_id into v_artist_id
    from tracks t join spaces s on s.id = t.space_id
   where t.id = new.track_id;

  if v_artist_id is null then
    return null;
  end if;

  perform award_artist_points(
    v_artist_id, new.user_id, 'session_completed', 'consistency', 3,
    'session', new.id, coalesce(new.ended_at, new.logged_at, now()),
    'session:' || new.id::text, 'trigger', 6);

  return null;
end;
$$;

drop trigger if exists trg_award_points_for_session on sessions;
create trigger trg_award_points_for_session
  after insert or update of status on sessions
  for each row execute function award_points_for_session();

-- ---------------------------------------------------------------------------
-- Rule 4 — a performance logged. +10 stage_presence, +6 more if it's a
-- festival. One-time per performance row (edits to a logged show don't
-- re-score it — the idempotency key is the row id, not its content).
-- ---------------------------------------------------------------------------
create or replace function award_points_for_performance() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_occurred timestamptz := (new.performed_on::text || 'T12:00:00')::timestamptz;
begin
  perform award_artist_points(
    new.artist_id, new.user_id, 'performance_logged', 'stage_presence', 10,
    'performance', new.id, v_occurred,
    'performance:' || new.id::text, 'trigger', null);

  if new.context = 'festival' then
    perform award_artist_points(
      new.artist_id, new.user_id, 'festival_played', 'stage_presence', 6,
      'performance', new.id, v_occurred,
      'performance-festival:' || new.id::text, 'trigger', null);
  end if;

  return null;
end;
$$;

drop trigger if exists trg_award_points_for_performance on performances;
create trigger trg_award_points_for_performance
  after insert on performances
  for each row execute function award_points_for_performance();
