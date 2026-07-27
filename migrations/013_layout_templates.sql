-- TEMPO migration 013 — saved track-workspace layout templates
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Lets a musician save the arrangement they've built as a named template and
-- reapply it to any track, alongside the built-in presets.

create table if not exists user_workspace_layout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  -- {"left":[["player"],["versions"]],"right":[["work","comments"]],"leftPct":60}
  layout jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One name per user, case-insensitive, so "Mixing" can't collide with "mixing".
create unique index if not exists idx_layout_templates_user_name
  on user_workspace_layout_templates (user_id, lower(trim(name)));

create index if not exists idx_layout_templates_user
  on user_workspace_layout_templates (user_id, created_at desc);

alter table user_workspace_layout_templates enable row level security;

drop policy if exists own_layout_templates on user_workspace_layout_templates;
create policy own_layout_templates on user_workspace_layout_templates for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
