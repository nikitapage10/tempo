-- TEMPO migration 058 — free up an archived scene's slug for reuse
--
-- Scenes are archived, never hard-deleted (SCENES-SPEC.md §1), so a deleted
-- scene's row — and its `slug text not null unique` constraint — stays in
-- the table forever. That meant deleting a scene and starting a new one
-- under the same name failed with "That address is taken," with no way to
-- ever reclaim it.
--
-- Fix: swap the table-wide unique constraint for a partial unique index that
-- only enforces uniqueness among non-archived scenes. Archived rows keep
-- whatever slug they had — nothing about them changes — but a new scene can
-- now take that slug once the old one is archived.

alter table scenes drop constraint if exists scenes_slug_key;

create unique index if not exists scenes_slug_active_key
  on scenes (slug)
  where archived_at is null;
