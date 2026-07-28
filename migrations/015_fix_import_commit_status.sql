-- TEMPO migration 015 — Import Studio: fix status on a retried commit
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Bug this fixes: commit_workspace_import() returns early when an import has
-- already been committed (so clicking "Build my workspace" twice can't create a
-- duplicate catalog — that part works). But the route sets status to
-- 'committing' before calling it, and the early return never set it back. A
-- retry, a double-click, or a reconnect therefore left the import stuck showing
-- as "building" forever, even though the catalog was already built.
--
-- Only the function body changes. Tables and policies from 014 are untouched.

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

  -- Already committed — hand back what we built the first time, and make sure
  -- the status reflects reality rather than whatever the caller set on the way in.
  if v_committed_at is not null then
    update onboarding_imports
    set status = 'completed', updated_at = now()
    where id = p_import_id;

    return coalesce(v_summary, '{}'::jsonb) || jsonb_build_object('alreadyCommitted', true);
  end if;

  -- ---------- Spaces ----------
  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'spaces', '[]'::jsonb))
  loop
    v_existing_id := nullif(v_item->>'existingId', '')::uuid;

    if v_existing_id is not null then
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

-- Repair any import already left stranded by the old behaviour.
update onboarding_imports
set status = 'completed'
where committed_at is not null and status <> 'completed';
