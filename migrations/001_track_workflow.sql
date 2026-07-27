-- TEMPO migration 001 — track workflow fields (Prompt 2)
-- Additive only. Run in Supabase SQL Editor. Do not drop/truncate tables.

alter table tracks
  add column if not exists next_action text,
  add column if not exists next_action_due date,
  add column if not exists blocked_reason text,
  add column if not exists waiting_on text,
  add column if not exists stage_entered_at timestamptz not null default now();

-- Backfill stage_entered_at for existing rows (already defaulted; keep updated_at as hint)
update tracks
set stage_entered_at = coalesce(updated_at, created_at, now())
where stage_entered_at is null;

create index if not exists idx_tracks_attention
  on tracks (user_id, momentum, next_action_due)
  where momentum in ('active', 'simmering', 'stalled');

create or replace function set_stage_entered_at() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    new.stage_entered_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stage_entered_at on tracks;
create trigger trg_stage_entered_at
  before update of stage_id on tracks
  for each row execute function set_stage_entered_at();
