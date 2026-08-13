-- TEMPO migration 085 — stage transition ledger (gamification foundation, part 1)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- Why this exists: tracks.stage_entered_at (migration 001) is overwritten on
-- every stage move, so it can answer "how long has this track sat in its
-- current stage" but never "how long did each past stage take". activity_events
-- (migration 009) carries stage_changed rows, but they are written best-effort
-- from the browser in lib/api/tracks.ts, failures are silently swallowed, and
-- the "from" stage is never recorded. A log that can silently drop rows cannot
-- be the basis of a median used to score or rate anything.
--
-- This table is written only by a security-definer trigger on tracks, so
-- every write path that changes stage_id is captured — not just the one UI
-- helper (moveTrackStage) that happens to call it today — and no client can
-- forge a row.

create table if not exists stage_transitions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,

  from_stage_id uuid references stages(id) on delete set null,
  to_stage_id uuid references stages(id) on delete set null,
  -- Sorts are snapshotted at write time. Reordering or renaming a pipeline
  -- later must not retroactively rewrite whether a past move was "forward".
  from_sort int,
  to_sort int,
  direction smallint not null check (direction in (-1, 0, 1)),

  entered_at timestamptz not null default now(),
  -- Closed by the next transition for the same track, so dwell time is a
  -- single-row read rather than a self-join.
  left_at timestamptz,
  dwell_sec bigint generated always as (
    case when left_at is null then null
         else greatest(0, (extract(epoch from (left_at - entered_at)))::bigint)
    end
  ) stored,

  source text not null default 'trigger' check (source in ('trigger', 'backfill')),
  created_at timestamptz not null default now(),

  constraint stage_transitions_interval check (left_at is null or left_at >= entered_at)
);

create index if not exists idx_stage_transitions_track_entered
  on stage_transitions (track_id, entered_at desc);
create index if not exists idx_stage_transitions_user_entered
  on stage_transitions (user_id, entered_at desc);
create index if not exists idx_stage_transitions_user_forward
  on stage_transitions (user_id, direction, entered_at desc)
  where direction = 1;

-- Integrity guard: a track sits in exactly one stage at a time, so exactly
-- one open (unclosed) dwell row can exist per track.
create unique index if not exists uq_stage_transitions_open
  on stage_transitions (track_id) where left_at is null;

alter table stage_transitions enable row level security;

-- Read-only to clients. There is deliberately no insert/update/delete policy:
-- the only writer is the security-definer trigger below. A ledger nobody can
-- edit from the browser is a ledger a rating can rest on.
drop policy if exists own_stage_transitions_select on stage_transitions;
create policy own_stage_transitions_select on stage_transitions
  for select using (user_id = auth.uid());

create or replace function log_stage_transition() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old_stage uuid := case when tg_op = 'UPDATE' then old.stage_id else null end;
  v_from_sort int;
  v_to_sort int;
  v_dir smallint;
  v_now timestamptz := now();
begin
  if tg_op = 'UPDATE' and new.stage_id is not distinct from v_old_stage then
    return null; -- AFTER trigger: return value is ignored either way
  end if;

  select sort into v_from_sort from stages where id = v_old_stage;
  select sort into v_to_sort from stages where id = new.stage_id;

  v_dir := case
    when v_from_sort is null or v_to_sort is null then 0
    when v_to_sort > v_from_sort then 1
    when v_to_sort < v_from_sort then -1
    else 0
  end;

  update stage_transitions
     set left_at = v_now
   where track_id = new.id and left_at is null;

  insert into stage_transitions (
    track_id, user_id, space_id, from_stage_id, to_stage_id,
    from_sort, to_sort, direction, entered_at, source)
  values (
    new.id, new.user_id, new.space_id, v_old_stage, new.stage_id,
    v_from_sort, v_to_sort, v_dir, v_now, 'trigger');

  return null;
end;
$$;

-- AFTER, not BEFORE: migration 001's trg_stage_entered_at is a BEFORE UPDATE
-- trigger that mutates NEW.stage_entered_at. This trigger only reads
-- new.stage_id, which that one never touches, so there is no ordering
-- conflict between the two.
drop trigger if exists trg_log_stage_transition on tracks;
create trigger trg_log_stage_transition
  after insert or update of stage_id on tracks
  for each row execute function log_stage_transition();

-- Backfill: one open row per existing track, seeded at its real
-- stage_entered_at with direction 0 (unknown — where it came from before
-- this ledger existed cannot be recovered). This makes "days in current
-- stage" correct immediately, and the track's *next* move is measurable
-- for real from the moment this migration runs.
insert into stage_transitions (
  track_id, user_id, space_id, from_stage_id, to_stage_id,
  from_sort, to_sort, direction, entered_at, source)
select t.id, t.user_id, t.space_id, null, t.stage_id,
       null, s.sort, 0, t.stage_entered_at, 'backfill'
  from tracks t
  left join stages s on s.id = t.stage_id
 where not exists (
   select 1 from stage_transitions x where x.track_id = t.id
 );
