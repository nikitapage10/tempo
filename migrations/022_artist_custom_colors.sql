-- TEMPO migration 022 — artist custom colors
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Optional overrides on top of the curated palette_id presets:
--   ice_color / amber_color — free Cool / Warm accents (null = use palette)
--   banner_color_end — second stop for a banner color gradient
--     (null = solid wash from banner_color alone)

alter table artists add column if not exists ice_color text;
alter table artists add column if not exists amber_color text;
alter table artists add column if not exists banner_color_end text;
