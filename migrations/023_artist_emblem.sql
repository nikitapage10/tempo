-- TEMPO migration 023 — artist emblem
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Splits identity imagery:
--   logo_url    — wider lockup shown large on Today
--   emblem_url  — square mark used as the artist's avatar/identity chip
-- Existing logo_url rows are left alone (still the Today logo).

alter table artists add column if not exists emblem_url text;
