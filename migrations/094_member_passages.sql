-- TEMPO migration 094 — Passage (invited-team-member onboarding)
-- Additive only. Run in Supabase SQL Editor. Drops nothing, truncates nothing,
-- rewrites nothing, and weakens no existing policy.
--
-- Backs PASSAGE: the first-run experience for someone formally invited by an
-- admin as a team member (manager, label owner, collective founder, and
-- everything between) rather than an artist. Shares ORIGIN's look, videos and
-- scroll mechanics but asks a different, non-artist set of questions. Everything
-- here is owner-private and purely descriptive — it never grants access or
-- changes what the member can do in the product.

create table if not exists member_passages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invite_id uuid references invites(id) on delete set null,

  status text not null default 'in_progress'
    check (status in ('in_progress', 'complete', 'skipped')),
  -- Stable state to resume on. Never a transition — see the reducer.
  current_step text not null default 'role'
    check (current_step in ('role', 'entry', 'support', 'function', 'look', 'story', 'complete')),

  -- What they picked from the role chips (see lib/passage/roles.ts), or null
  -- while still on that step.
  role_title text,
  -- Free text when "Something else" is chosen instead of a preset chip.
  role_title_other text,
  -- What got them into the music industry.
  entry_text text,
  -- Who or what they support — an artist, a roster, a label, a collective.
  supports_text text,
  -- What they actually do day to day.
  function_text text,

  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint member_passages_role_title_len
    check (role_title is null or char_length(role_title) <= 80),
  constraint member_passages_role_title_other_len
    check (role_title_other is null or char_length(role_title_other) <= 120),
  constraint member_passages_entry_len
    check (entry_text is null or char_length(entry_text) <= 4000),
  constraint member_passages_supports_len
    check (supports_text is null or char_length(supports_text) <= 2000),
  constraint member_passages_function_len
    check (function_text is null or char_length(function_text) <= 2000)
);

create index if not exists idx_member_passages_invite on member_passages (invite_id);

-- ---------- RLS ----------

alter table member_passages enable row level security;

drop policy if exists own_member_passages on member_passages;
create policy own_member_passages on member_passages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- updated_at ----------

create or replace function touch_member_passages()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_member_passages on member_passages;
create trigger trg_touch_member_passages
  before update on member_passages
  for each row execute function touch_member_passages();
