-- TEMPO migration 016 — floating assistant daily spend cap
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Tracks how many assistant messages and escalations each signed-in user has
-- used per UTC day, so the floating help panel can stay cheap without an
-- in-memory counter that would vanish across serverless instances.

create table if not exists assistant_usage (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null default (now() at time zone 'utc')::date,
  messages    integer not null default 0,
  escalations integer not null default 0,
  primary key (user_id, day)
);

alter table assistant_usage enable row level security;

create policy assistant_usage_own on assistant_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
