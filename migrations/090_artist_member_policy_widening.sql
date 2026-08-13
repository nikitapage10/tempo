-- TEMPO migration 090 — team member read/write access (part 2 of artist membership)
-- Additive only, and deliberately kept in its own migration so it can be
-- reverted independently of 089 if any policy here ever needs rolling back.
--
-- Every policy added below is a NEW, additional permissive policy. Owner
-- policies are not touched. Postgres OR's permissive policies for the same
-- command together, so a team member's access is purely additive on top of
-- the owner's; there is no way this migration can narrow what an artist
-- owner can already do.
--
-- `drop policy if exists` before each create only recreates these same
-- named member policies so GitHub Actions can re-apply the numbered set
-- on every migrations/ push (the workflow has no "already applied" ledger).
--
-- Scope for this first pass, deliberately conservative: SELECT widening
-- across catalog/calendar/stats/performances (a manager or agent can see
-- everything relevant), plus WRITE widening only on the two areas an
-- external team member most obviously needs hands-on — calendar and
-- performances (a tour manager schedules and logs shows) — and catalog
-- metadata edits on spaces/tracks (an assistant updating track info).
-- Track/space/project creation and deletion, and every account- or
-- artist-identity-level action, stay owner-only. Widen further in a later,
-- separately reviewed migration if the artist-side UI calls for it.

-- ---------------------------------------------------------------------------
-- artists — a member needs to see (and switch into) an artist they don't own.
-- ---------------------------------------------------------------------------
drop policy if exists member_read_artists on artists;
create policy member_read_artists on artists for select
  using (is_artist_member(id));

-- ---------------------------------------------------------------------------
-- spaces / tracks / projects — the "catalog" area.
-- ---------------------------------------------------------------------------
drop policy if exists member_read_spaces on spaces;
create policy member_read_spaces on spaces for select
  using (can_read_artist_area(artist_id, 'catalog'));
drop policy if exists member_write_spaces on spaces;
create policy member_write_spaces on spaces for update
  using (can_write_artist_area(artist_id, 'catalog'))
  with check (can_write_artist_area(artist_id, 'catalog'));

drop policy if exists member_read_tracks on tracks;
create policy member_read_tracks on tracks for select
  using (
    exists (
      select 1 from spaces s
      where s.id = tracks.space_id and can_read_artist_area(s.artist_id, 'catalog')
    )
  );
drop policy if exists member_write_tracks on tracks;
create policy member_write_tracks on tracks for update
  using (
    exists (
      select 1 from spaces s
      where s.id = tracks.space_id and can_write_artist_area(s.artist_id, 'catalog')
    )
  )
  with check (
    exists (
      select 1 from spaces s
      where s.id = tracks.space_id and can_write_artist_area(s.artist_id, 'catalog')
    )
  );

drop policy if exists member_read_projects on projects;
create policy member_read_projects on projects for select
  using (
    exists (
      select 1 from spaces s
      where s.id = projects.space_id and can_read_artist_area(s.artist_id, 'catalog')
    )
  );

-- ---------------------------------------------------------------------------
-- calendar_events — the "calendar" area.
-- ---------------------------------------------------------------------------
drop policy if exists member_read_calendar_events on calendar_events;
create policy member_read_calendar_events on calendar_events for select
  using (
    exists (
      select 1 from spaces s
      where s.id = calendar_events.space_id and can_read_artist_area(s.artist_id, 'calendar')
    )
  );
drop policy if exists member_write_calendar_events_insert on calendar_events;
create policy member_write_calendar_events_insert on calendar_events for insert
  with check (
    exists (
      select 1 from spaces s
      where s.id = calendar_events.space_id and can_write_artist_area(s.artist_id, 'calendar')
    )
  );
drop policy if exists member_write_calendar_events_update on calendar_events;
create policy member_write_calendar_events_update on calendar_events for update
  using (
    exists (
      select 1 from spaces s
      where s.id = calendar_events.space_id and can_write_artist_area(s.artist_id, 'calendar')
    )
  )
  with check (
    exists (
      select 1 from spaces s
      where s.id = calendar_events.space_id and can_write_artist_area(s.artist_id, 'calendar')
    )
  );

-- ---------------------------------------------------------------------------
-- platform_snapshots / artist_custom_stats(+entries) — the "stats" area.
-- Read-only: attribute/point/achievement ledgers stay owner-only regardless
-- of any grant (see migrations 087/088 — no member policy is ever added
-- there, on purpose. Personal means personal.
-- ---------------------------------------------------------------------------
drop policy if exists member_read_platform_snapshots on platform_snapshots;
create policy member_read_platform_snapshots on platform_snapshots for select
  using (can_read_artist_area(artist_id, 'stats'));

drop policy if exists member_read_custom_stats on artist_custom_stats;
create policy member_read_custom_stats on artist_custom_stats for select
  using (
    exists (
      select 1 from artist_custom_modules m
      where m.id = artist_custom_stats.module_id and can_read_artist_area(m.artist_id, 'stats')
    )
  );
drop policy if exists member_read_custom_stat_entries on artist_custom_stat_entries;
create policy member_read_custom_stat_entries on artist_custom_stat_entries for select
  using (
    exists (
      select 1 from artist_custom_stats s
      join artist_custom_modules m on m.id = s.module_id
      where s.id = artist_custom_stat_entries.stat_id
        and can_read_artist_area(m.artist_id, 'stats')
    )
  );

-- ---------------------------------------------------------------------------
-- performances — the "performances" area (migration 086).
-- ---------------------------------------------------------------------------
drop policy if exists member_read_performances on performances;
create policy member_read_performances on performances for select
  using (can_read_artist_area(artist_id, 'performances'));
drop policy if exists member_write_performances_insert on performances;
create policy member_write_performances_insert on performances for insert
  with check (can_write_artist_area(artist_id, 'performances'));
drop policy if exists member_write_performances_update on performances;
create policy member_write_performances_update on performances for update
  using (can_write_artist_area(artist_id, 'performances'))
  with check (can_write_artist_area(artist_id, 'performances'));
