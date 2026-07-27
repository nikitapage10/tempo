-- TEMPO migration 006 — focus sessions (Prompt 7)

alter table sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'completed'
    check (status in ('active','completed','abandoned')),
  add column if not exists goal text,
  add column if not exists outcome text,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists elapsed_sec int,
  add column if not exists next_action_after text,
  add column if not exists created_at timestamptz not null default now();

-- Backfill user_id from track ownership
update sessions s
set user_id = t.user_id
from tracks t
where s.track_id = t.id
  and s.user_id is null;

do $$
begin
  if not exists (select 1 from sessions where user_id is null) then
    alter table sessions alter column user_id set not null;
  end if;
end $$;

-- Historical rows: treat as completed
update sessions
set status = 'completed',
    started_at = coalesce(started_at, logged_at),
    ended_at = coalesce(ended_at, logged_at)
where status = 'completed' and started_at is null;

create unique index if not exists idx_sessions_one_active_per_user
  on sessions (user_id)
  where status = 'active';

create index if not exists idx_sessions_user_status on sessions (user_id, status);
