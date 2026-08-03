-- 044 — Track groups get an identity, and the ungrouped run gets a position.
--
-- Three small additions, no data is moved or removed:
--
--   * track_groups.cover_url    — storage path of an optional album/EP image,
--                                 shown as a thumbnail beside the group name.
--                                 Same private bucket as every other upload.
--   * track_groups.accent_color — one of a small fixed palette, so groups can
--                                 be told apart at a glance. Null = no tint,
--                                 which is what every existing group gets.
--   * spaces.ungrouped_sort     — where the run of tracks that are in no group
--                                 sits among the groups. Defaults to -1, i.e.
--                                 above all of them (group sort starts at 0),
--                                 which is where loose tracks belong until you
--                                 deliberately move a group over the top.
--
-- Safe to run more than once.

alter table track_groups
  add column if not exists cover_url text;

alter table track_groups
  add column if not exists accent_color text;

-- Guard the tint against anything the UI doesn't know how to render.
--
-- The migration workflow replays every numbered file against the already-
-- evolved production schema. Migration 045 adds the `custom` value, so 044
-- must continue to accept it on later replays; otherwise this temporary
-- constraint rejects existing custom-colored groups before 045 runs again.
alter table track_groups
  drop constraint if exists track_groups_accent_color_valid;
alter table track_groups
  add constraint track_groups_accent_color_valid check (
    accent_color is null
    or accent_color in ('ice', 'amber', 'violet', 'ok', 'warn', 'custom')
  );

alter table spaces
  add column if not exists ungrouped_sort int not null default -1;
