-- TEMPO migration 020 — board sticky notes
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Notes live only on the Board (always in a stage). They are not tracks and
-- do not appear in Tracks / Today catalog lists.

create table if not exists board_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  title text not null,
  body text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_notes_title_len check (
    char_length(trim(title)) >= 1 and char_length(title) <= 120
  )
);

create index if not exists idx_board_notes_space_stage
  on board_notes (space_id, stage_id, sort);

alter table board_notes enable row level security;

drop policy if exists own_board_notes on board_notes;
create policy own_board_notes on board_notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
