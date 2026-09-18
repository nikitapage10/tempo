-- TEMPO migration 123 — drop Top 8 picks whose profile no longer exists.
--
-- artist_profiles.top8 is a plain uuid[] with no foreign key, so deleting a
-- profile (migration 077 retired the synthetic starter cast) left dead ids
-- behind. A full-but-invisible list still counts against the eight slots, so
-- the picker renders "Add someone" buttons that silently refuse every pick.

with cleaned as (
  select
    p.id,
    coalesce(
      (
        select array_agg(t.pid order by t.ord)
        from unnest(p.top8) with ordinality as t(pid, ord)
        where exists (select 1 from artist_profiles q where q.id = t.pid)
      ),
      '{}'::uuid[]
    ) as next_top8
  from artist_profiles p
  where array_length(p.top8, 1) is not null
)
update artist_profiles p
set top8 = c.next_top8
from cleaned c
where p.id = c.id
  and p.top8 is distinct from c.next_top8;

insert into schema_migrations (version, name, checksum, applied_by)
values (123, '123_prune_deleted_top8_picks', 'initial', 'migration-self-register')
on conflict (version) do nothing;
