-- TEMPO migration 088 — achievement awards (gamification, part 3)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- The ~100 achievement *definitions* (name, flavor text, spectral grade, the
-- predicate that decides when it fires) live in code, in
-- lib/gamification/achievements.ts — no admin UI and no seed migration, so
-- the catalog stays reviewable in a diff and shippable without a database
-- change. This table only records which of those definitions a given artist
-- has actually earned, and when.
--
-- Evaluation runs server-side (lib/gamification/evaluate.ts, called from
-- app/api/gamification/evaluate) rather than in a trigger, because a
-- predicate needs the full derived attribute context, not one row's worth of
-- data. The unique constraint below is what makes a double evaluation safe:
-- awarding the same key twice is a silent no-op, never a duplicate row.

create table if not exists artist_achievements (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  achievement_key text not null,
  awarded_at timestamptz not null default now(),
  -- Drives the pop-up queue: null means "hasn't been shown yet". Backfilled
  -- awards are inserted with this already set, so opening the sheet for the
  -- first time on an artist with years of history doesn't fire forty toasts.
  seen_at timestamptz,
  source text not null default 'live' check (source in ('live', 'backfill')),
  unique (artist_id, achievement_key)
);

create index if not exists idx_artist_achievements_artist_awarded
  on artist_achievements (artist_id, awarded_at desc);
create index if not exists idx_artist_achievements_unseen
  on artist_achievements (artist_id, awarded_at)
  where seen_at is null;

alter table artist_achievements enable row level security;

-- Personal, like the point ledger and attributes: never public, never
-- readable by a team member even with a stats:read grant (stream 3, later).
-- Writes go through the service-role evaluate route, not client inserts —
-- an achievement that could be granted from the browser wouldn't mean
-- anything — so this policy only ever needs to cover reads and the one
-- client action (marking a toast seen).
drop policy if exists own_artist_achievements on artist_achievements;
create policy own_artist_achievements on artist_achievements for select
  using (user_id = auth.uid());

drop policy if exists mark_artist_achievements_seen on artist_achievements;
create policy mark_artist_achievements_seen on artist_achievements for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
