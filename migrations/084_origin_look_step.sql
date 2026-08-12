-- TEMPO migration 084 — Origin look step resume target
-- Additive only. Run in Supabase SQL Editor after 083.
-- Extends artist_origins.current_step so drafts can resume on the optional
-- look customization beat (palette / logo / emblem / banner) between
-- direction and processing. No rows are rewritten.

do $$
declare
  con text;
begin
  select c.conname into con
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'artist_origins'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%current_step%'
  limit 1;

  if con is not null then
    execute format('alter table artist_origins drop constraint %I', con);
  end if;
end $$;

alter table artist_origins
  add constraint artist_origins_current_step_check
  check (
    current_step in (
      'name',
      'introduction',
      'processing',
      'review',
      'look',
      'story',
      'complete'
    )
  );
