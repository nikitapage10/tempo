-- TEMPO migration 026 — allow more than one custom-stat reading per day
-- Additive/relaxing only. Run in Supabase SQL Editor. Drops no data.
--
-- Migration 025 made a second log on the same day silently overwrite the
-- first, matching how the read-only platform snapshots behave (one row a day
-- because that's all Spotify/SoundCloud ever give an app). Hand-entered stats
-- are different: someone logging merch sold or sync placements may want
-- several readings the same day, or to back-fill a stretch of days at once.
-- Dropping the constraint just stops rejecting/overwriting those — existing
-- rows are untouched, and `created_at` already orders same-day rows.

alter table artist_custom_stat_entries
  drop constraint if exists artist_custom_stat_entries_stat_id_recorded_on_key;
