-- 019: space focus mode (music vs. tasks) + task space scoping.
--
-- Spaces can now be "tasks"-focused instead of "music"-focused — a
-- non-musical workspace (e.g. running social media) that shows Tasks and
-- Projects instead of Board and Tracks. See CHANGELOG.md for the v0.33.0
-- entry.
--
-- Tasks did not previously belong to a space at all, so this also adds
-- tasks.space_id and backfills it where derivable (via the task's linked
-- track or project). Tasks with neither link cannot be safely assigned to a
-- space and are left with space_id = null — they will stop appearing on
-- /tasks until re-added inside a space. This is a one-time, disclosed
-- limitation of the backfill, not a bug.

alter table spaces
  add column if not exists focus text not null default 'music'
    check (focus in ('music', 'tasks'));

alter table tasks
  add column if not exists space_id uuid references spaces(id) on delete cascade;

-- Backfill via the task's track, then via its project, for existing rows only.
update tasks t
set space_id = tr.space_id
from tracks tr
where t.track_id = tr.id
  and t.space_id is null;

update tasks t
set space_id = p.space_id
from projects p
where t.project_id = p.id
  and t.space_id is null
  and p.space_id is not null;

create index if not exists idx_tasks_space on tasks(space_id);

-- RLS: unchanged. own_tasks already scopes by user_id (schema.sql); space_id
-- is an additional app-level filter, not a security boundary, and legacy
-- null-space rows must remain readable by their owner.
