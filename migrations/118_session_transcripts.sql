-- Sessions V2: opt-in per-instance note taking and private transcript lines.
-- Additive only. Run manually after migration 117.

alter table session_meets
  add column if not exists notes_enabled boolean not null default false;

create table if not exists session_transcript_lines (
  id uuid primary key default gen_random_uuid(),
  session_meet_id uuid not null references session_meets(id) on delete cascade,
  speaker_user_id uuid references auth.users(id) on delete set null,
  speaker_label text not null default '',
  body text not null check (char_length(body) between 1 and 4000),
  said_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_session_transcript_meet
  on session_transcript_lines (session_meet_id, said_at);

alter table session_transcript_lines enable row level security;

drop policy if exists session_members_read_transcript on session_transcript_lines;
create policy session_members_read_transcript on session_transcript_lines
for select to authenticated
using (
  exists (
    select 1
    from session_meets meet
    join session_members member on member.session_room_id = meet.session_room_id
    where meet.id = session_transcript_lines.session_meet_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

drop policy if exists session_members_add_own_transcript on session_transcript_lines;
create policy session_members_add_own_transcript on session_transcript_lines
for insert to authenticated
with check (
  speaker_user_id = auth.uid()
  and exists (
    select 1
    from session_meets meet
    join session_members member on member.session_room_id = meet.session_room_id
    where meet.id = session_transcript_lines.session_meet_id
      and meet.ended_at is null
      and meet.notes_enabled = true
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

alter table assistant_usage
  add column if not exists audio_seconds integer not null default 0;
