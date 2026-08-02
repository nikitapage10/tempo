-- TEMPO migration 046 — simplify track types to non-overlapping categories.
-- Collaboration remains represented by track_collaborators / credits.
-- A bootleg is treated as an edit.

update tracks
set type = case
  when type = 'collab' then 'original'
  when type = 'bootleg' then 'edit'
  else type
end
where type in ('collab', 'bootleg');

alter table tracks drop constraint if exists tracks_type_check;
alter table tracks
  add constraint tracks_type_check
  check (type in ('original', 'remix', 'edit'));
