-- TEMPO migration 014 — Import Studio (AI-assisted onboarding)
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Backs the "bring your music with you" flow: an artist hands TEMPO whatever
-- they already have (typed notes, a pasted song list, a voice memo, screenshots
-- of project folders, a release spreadsheet), TEMPO proposes a workspace, and
-- nothing is written to the real catalog until the artist approves it.
--
-- Three tables, plus one transactional commit function. The proposed workspace
-- itself lives as jsonb (same idea as templates.items and stage_recipes.actions)
-- because it is edited wholesale in the review screen and committed exactly once.

-- ---------- Import sessions ----------

create table if not exists onboarding_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in (
    'draft','extracting','synthesizing','needs_review',
    'committing','completed','failed','cancelled'
  )),
  -- The proposed workspace. See lib/ai/import-plan-schema.ts for the shape.
  plan jsonb,
  -- Counts + what was created, shown on the confirmation screen.
  summary jsonb,
  model text,
  input_tokens int,
  output_tokens int,
  error text,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onboarding_imports_user
  on onboarding_imports (user_id, created_at desc);

-- ---------- Source material ----------

create table if not exists onboarding_sources (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references onboarding_imports(id) on delete cascade,
  kind text not null check (kind in ('text','voice','image','document')),
  label text,
  -- Storage path under the private `audio` bucket: imports/{import_id}/{source_id}/{file}
  storage_path text,
  byte_size bigint,
  mime_type text,
  -- Whatever we managed to read out of this source, in plain text.
  extracted_text text,
  status text not null default 'pending' check (status in (
    'pending','extracting','ready','failed','excluded'
  )),
  error text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_onboarding_sources_import
  on onboarding_sources (import_id, sort, created_at);

-- ---------- Audit of what was actually created ----------

create table if not exists onboarding_commits (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references onboarding_imports(id) on delete cascade,
  entity_type text not null check (entity_type in ('space','stage','project','track','task','checklist_item')),
  entity_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_onboarding_commits_import
  on onboarding_commits (import_id, entity_type);

-- ---------- RLS ----------
-- Strictly owner-only. Track collaborators must never reach an import: it holds
-- proposed spaces/projects/tasks, which SECURITY-AND-PERMISSIONS.md §3 says
-- collaborators may not enumerate.

alter table onboarding_imports enable row level security;
alter table onboarding_sources enable row level security;
alter table onboarding_commits enable row level security;

drop policy if exists own_onboarding_imports on onboarding_imports;
create policy own_onboarding_imports on onboarding_imports for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_onboarding_sources on onboarding_sources;
create policy own_onboarding_sources on onboarding_sources for all
  using (exists (
    select 1 from onboarding_imports i
    where i.id = import_id and i.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from onboarding_imports i
    where i.id = import_id and i.user_id = auth.uid()
  ));

drop policy if exists own_onboarding_commits on onboarding_commits;
create policy own_onboarding_commits on onboarding_commits for all
  using (exists (
    select 1 from onboarding_imports i
    where i.id = import_id and i.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from onboarding_imports i
    where i.id = import_id and i.user_id = auth.uid()
  ));

-- ---------- Transactional commit ----------
--
-- Builds the approved workspace in one transaction. Either the whole catalog
-- lands or none of it does — a half-created catalog is the worst outcome here,
-- and it would be tedious to clean up by hand.
--
-- Idempotent: a second call (double-click, retry after a dropped connection)
-- returns the first call's summary instead of creating a duplicate catalog.
--
-- p_plan is the APPROVED plan, already filtered to the artist's selections:
-- {
--   "spaces":   [{"ref":"s1","name":"Originals","existingId":"uuid|null"}],
--   "projects": [{"ref":"p1","name":"Echoes","projectType":"ep","spaceRef":"s1",
--                 "description":null,"deadline":null}],
--   "tracks":   [{"ref":"t1","title":"Afterglow","type":"original","spaceRef":"s1",
--                 "projectRef":"p1","stageName":"Production","momentum":"active",
--                 "bpm":128,"musicalKey":"F#m","genre":null,"destination":null,
--                 "deadline":null,"nextAction":null,"nextActionDue":null,
--                 "blockedReason":null,"waitingOn":null,"tags":[],"notes":null,
--                 "checklist":["Lock the hook"]}],
--   "tasks":    [{"ref":"k1","title":"Send to mixer","category":"admin",
--                 "dueDate":null,"notes":null,"trackRef":"t1","projectRef":null}]
-- }
--
-- Deliberately does NOT create versions — this release imports catalog structure,
-- not bounces. (versions.version_no is trigger-managed anyway; see set_version_no.)

create or replace function commit_workspace_import(p_import_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_committed_at timestamptz;
  v_summary jsonb;
  v_space_ids jsonb := '{}'::jsonb;   -- ref -> uuid
  v_project_ids jsonb := '{}'::jsonb;
  v_track_ids jsonb := '{}'::jsonb;
  v_item jsonb;
  v_new_id uuid;
  v_space_id uuid;
  v_stage_id uuid;
  v_project_id uuid;
  v_track_id uuid;
  v_stage_name text;
  v_existing_id uuid;
  v_sort int;
  v_checklist jsonb;
  v_checklist_item jsonb;
  v_idx int;
  n_spaces int := 0;
  n_stages int := 0;
  n_projects int := 0;
  n_tracks int := 0;
  n_tasks int := 0;
  n_checklist int := 0;
  v_default_stages text[] := array[
    'Idea','Writing','Production','Mixdown','Master','Release Prep','Released'
  ];
begin
  -- Ownership + idempotency guard, taken under a row lock so two concurrent
  -- commits can't both pass the check.
  select user_id, committed_at, summary
    into v_user_id, v_committed_at, v_summary
  from onboarding_imports
  where id = p_import_id
  for update;

  if v_user_id is null then
    raise exception 'Import not found.' using errcode = 'no_data_found';
  end if;

  if v_user_id <> auth.uid() then
    raise exception 'Not your import.' using errcode = 'insufficient_privilege';
  end if;

  -- Already committed — hand back what we built the first time.
  if v_committed_at is not null then
    return coalesce(v_summary, '{}'::jsonb) || jsonb_build_object('alreadyCommitted', true);
  end if;

  -- ---------- Spaces ----------
  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'spaces', '[]'::jsonb))
  loop
    v_existing_id := nullif(v_item->>'existingId', '')::uuid;

    if v_existing_id is not null then
      -- Reuse an existing space, but only if this artist actually owns it.
      select id into v_space_id
      from spaces
      where id = v_existing_id and user_id = v_user_id;

      if v_space_id is null then
        raise exception 'Space does not belong to you.' using errcode = 'insufficient_privilege';
      end if;
    else
      select coalesce(max(sort), -1) + 1 into v_sort from spaces where user_id = v_user_id;

      insert into spaces (user_id, name, sort)
      values (v_user_id, v_item->>'name', v_sort)
      returning id into v_space_id;

      n_spaces := n_spaces + 1;
      insert into onboarding_commits (import_id, entity_type, entity_id)
      values (p_import_id, 'space', v_space_id);

      -- A brand-new space needs the standard pipeline, same as createSpace() does.
      for v_idx in 1 .. array_length(v_default_stages, 1)
      loop
        insert into stages (space_id, name, sort)
        values (v_space_id, v_default_stages[v_idx], v_idx - 1)
        returning id into v_new_id;

        n_stages := n_stages + 1;
        insert into onboarding_commits (import_id, entity_type, entity_id)
        values (p_import_id, 'stage', v_new_id);
      end loop;
    end if;

    v_space_ids := v_space_ids || jsonb_build_object(v_item->>'ref', v_space_id::text);
  end loop;

  -- ---------- Projects ----------
  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'projects', '[]'::jsonb))
  loop
    v_space_id := nullif(v_space_ids->>(v_item->>'spaceRef'), '')::uuid;

    insert into projects (user_id, space_id, name, description, deadline, project_type)
    values (
      v_user_id,
      v_space_id,
      v_item->>'name',
      nullif(v_item->>'description', ''),
      nullif(v_item->>'deadline', '')::date,
      coalesce(nullif(v_item->>'projectType', ''), 'general')
    )
    returning id into v_project_id;

    n_projects := n_projects + 1;
    insert into onboarding_commits (import_id, entity_type, entity_id)
    values (p_import_id, 'project', v_project_id);

    v_project_ids := v_project_ids || jsonb_build_object(v_item->>'ref', v_project_id::text);
  end loop;

  -- ---------- Tracks (+ their checklists) ----------
  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'tracks', '[]'::jsonb))
  loop
    v_space_id := nullif(v_space_ids->>(v_item->>'spaceRef'), '')::uuid;

    if v_space_id is null then
      raise exception 'Track "%" has no space.', v_item->>'title' using errcode = 'invalid_parameter_value';
    end if;

    -- Resolve the stage by name within that space (case-insensitive).
    v_stage_name := nullif(v_item->>'stageName', '');
    v_stage_id := null;
    if v_stage_name is not null then
      select id into v_stage_id
      from stages
      where space_id = v_space_id and lower(trim(name)) = lower(trim(v_stage_name))
      limit 1;
    end if;

    v_project_id := nullif(v_project_ids->>(v_item->>'projectRef'), '')::uuid;

    insert into tracks (
      user_id, space_id, project_id, stage_id, title, type, artist_alias,
      bpm, musical_key, genre, destination, deadline, momentum, tags, notes,
      next_action, next_action_due, blocked_reason, waiting_on
    )
    values (
      v_user_id,
      v_space_id,
      v_project_id,
      v_stage_id,
      v_item->>'title',
      coalesce(nullif(v_item->>'type', ''), 'original'),
      nullif(v_item->>'artistAlias', ''),
      nullif(v_item->>'bpm', '')::numeric,
      nullif(v_item->>'musicalKey', ''),
      nullif(v_item->>'genre', ''),
      nullif(v_item->>'destination', ''),
      nullif(v_item->>'deadline', '')::date,
      coalesce(nullif(v_item->>'momentum', ''), 'active'),
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(
          case when jsonb_typeof(v_item->'tags') = 'array' then v_item->'tags' else '[]'::jsonb end
        ) as value),
        '{}'::text[]
      ),
      nullif(v_item->>'notes', ''),
      nullif(v_item->>'nextAction', ''),
      nullif(v_item->>'nextActionDue', '')::date,
      nullif(v_item->>'blockedReason', ''),
      nullif(v_item->>'waitingOn', '')
    )
    returning id into v_track_id;

    n_tracks := n_tracks + 1;
    insert into onboarding_commits (import_id, entity_type, entity_id)
    values (p_import_id, 'track', v_track_id);

    v_track_ids := v_track_ids || jsonb_build_object(v_item->>'ref', v_track_id::text);

    v_checklist := case
      when jsonb_typeof(v_item->'checklist') = 'array' then v_item->'checklist'
      else '[]'::jsonb
    end;

    v_idx := 0;
    for v_checklist_item in select * from jsonb_array_elements(v_checklist)
    loop
      insert into checklist_items (track_id, text, sort)
      values (v_track_id, trim(both '"' from v_checklist_item::text), v_idx)
      returning id into v_new_id;

      n_checklist := n_checklist + 1;
      v_idx := v_idx + 1;
      insert into onboarding_commits (import_id, entity_type, entity_id)
      values (p_import_id, 'checklist_item', v_new_id);
    end loop;
  end loop;

  -- ---------- Tasks ----------
  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'tasks', '[]'::jsonb))
  loop
    insert into tasks (user_id, track_id, project_id, title, category, due_date, notes)
    values (
      v_user_id,
      nullif(v_track_ids->>(v_item->>'trackRef'), '')::uuid,
      nullif(v_project_ids->>(v_item->>'projectRef'), '')::uuid,
      v_item->>'title',
      coalesce(nullif(v_item->>'category', ''), 'other'),
      nullif(v_item->>'dueDate', '')::date,
      nullif(v_item->>'notes', '')
    )
    returning id into v_new_id;

    n_tasks := n_tasks + 1;
    insert into onboarding_commits (import_id, entity_type, entity_id)
    values (p_import_id, 'task', v_new_id);
  end loop;

  v_summary := jsonb_build_object(
    'spaces', n_spaces,
    'stages', n_stages,
    'projects', n_projects,
    'tracks', n_tracks,
    'tasks', n_tasks,
    'checklistItems', n_checklist,
    'spaceIds', v_space_ids,
    'projectIds', v_project_ids,
    'trackIds', v_track_ids
  );

  update onboarding_imports
  set status = 'completed',
      committed_at = now(),
      summary = v_summary,
      updated_at = now()
  where id = p_import_id;

  return v_summary || jsonb_build_object('alreadyCommitted', false);
end;
$$;

revoke all on function commit_workspace_import(uuid, jsonb) from public;
grant execute on function commit_workspace_import(uuid, jsonb) to authenticated;
