-- TEMPO migration 005 — stage recipes (Prompt 6)

create table if not exists stage_recipes (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null unique references stages(id) on delete cascade,
  enabled boolean not null default true,
  execution_mode text not null default 'preview'
    check (execution_mode in ('preview','automatic')),
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stage_recipe_runs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references stage_recipes(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  transition_key text not null unique,
  status text not null check (status in ('pending','applied','skipped','partial','failed')),
  action_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_recipe_runs_track on stage_recipe_runs (track_id, created_at desc);

alter table stage_recipes enable row level security;
alter table stage_recipe_runs enable row level security;

drop policy if exists own_stage_recipes on stage_recipes;
create policy own_stage_recipes on stage_recipes for all
  using (
    exists (
      select 1 from stages st
      join spaces s on s.id = st.space_id
      where st.id = stage_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from stages st
      join spaces s on s.id = st.space_id
      where st.id = stage_id and s.user_id = auth.uid()
    )
  );

drop policy if exists own_stage_recipe_runs on stage_recipe_runs;
create policy own_stage_recipe_runs on stage_recipe_runs for all
  using (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  );
