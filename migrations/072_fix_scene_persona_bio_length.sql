-- TEMPO migration 072 — fix scene_persona_bio_len ceiling (bugfix)
-- Additive/corrective only. Drops nothing, truncates nothing, touches no
-- row data — only widens one CHECK constraint.
--
-- Root cause: migration 060 created scene_personas.bio with a 1000-
-- character cap and backfills it directly from artist_profiles.bio, whose
-- own cap (028_artist_profiles.sql) is 2000 characters. Any real profile
-- bio between 1001-2000 characters has always violated this constraint —
-- it just never surfaced until a bio in that range actually existed and a
-- migration-replay tried to (re-)insert/backfill it. Because the ongoing
-- CI workflow (.github/workflows/supabase-migrations.yml) replays every
-- migration file in order on every push and stops at the first failure,
-- this one constraint was blocking every migration numbered after it,
-- including this program's 068-071 — even though none of them touch
-- Scenes at all.
--
-- Fix: raise the persona bio cap to match its source (2000), so the
-- existing 060 backfill INSERT can succeed exactly as originally intended,
-- for any account regardless of bio length. No existing scene_personas
-- rows are touched — this only changes what's allowed going forward.

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'scene_persona_bio_len'
  ) then
    alter table scene_personas drop constraint scene_persona_bio_len;
  end if;
end $$;

alter table scene_personas
  add constraint scene_persona_bio_len check (bio is null or char_length(bio) <= 2000);

insert into schema_migrations (version, name, checksum, applied_by)
values (72, '072_fix_scene_persona_bio_length', 'initial', 'migration-self-register')
on conflict (version) do nothing;
