-- TEMPO migration 017 — Tracks list custom order
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Adds list_sort so the Tracks page can save a manual drag order per space.
-- Existing rows are backfilled to match today's "recently updated" list order.

alter table tracks
  add column if not exists list_sort int not null default 0;

-- Per-space backfill: 0..n-1 by updated_at desc (previous Tracks default).
with ranked as (
  select
    id,
    (row_number() over (
      partition by space_id
      order by updated_at desc nulls last, title asc
    ) - 1)::int as rn
  from tracks
)
update tracks t
set list_sort = ranked.rn
from ranked
where t.id = ranked.id;

create index if not exists idx_tracks_space_list_sort
  on tracks (space_id, list_sort);
