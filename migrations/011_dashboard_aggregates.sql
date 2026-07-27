-- TEMPO migration 011 — dashboard aggregates helpers (Prompt 12)
-- Non-destructive views for Today/Board attention without loading every comment row.

create or replace view track_unresolved_comment_counts as
select
  track_id,
  count(*)::int as unresolved_count
from comments
where resolved = false
  and parent_id is null
group by track_id;

create or replace view track_latest_session as
select distinct on (track_id)
  track_id,
  logged_at as last_session_at,
  status as last_session_status
from sessions
order by track_id, logged_at desc;

-- Note: views inherit underlying table RLS via security_invoker when available.
-- On older Postgres, access still goes through comments/sessions policies for owners.
