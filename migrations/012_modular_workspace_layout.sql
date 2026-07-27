-- TEMPO migration 012 — modular track workspace layout
-- Additive only. Run in Supabase SQL Editor. Does not drop or rewrite anything.
--
-- Adds a two-column module layout to the existing workspace preferences row.
-- Shape: {"left": ["player","versions"], "right": ["work","comments"]}
--
-- Modules absent from both arrays are hidden. When module_layout is null the
-- app falls back to the legacy module_order / hidden_modules columns, so rows
-- saved before this migration keep working untouched.

alter table user_track_workspace_preferences
  add column if not exists module_layout jsonb;

comment on column user_track_workspace_preferences.module_layout is
  'Two-column track workspace layout: {"left":[moduleId],"right":[moduleId]}. Null = derive from legacy module_order/hidden_modules.';
