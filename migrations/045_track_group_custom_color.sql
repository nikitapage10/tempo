-- 045 — A free custom color for track groups, alongside the fixed palette.
--
-- accent_color gains a 'custom' value; accent_hex holds the picked color for
-- that case (null otherwise). Kept as two columns rather than repurposing
-- accent_color to hold hex directly, so the fixed-palette values stay a tight
-- enum the UI can render without guessing.
--
-- Safe to run more than once.

alter table track_groups
  add column if not exists accent_hex text;

alter table track_groups
  drop constraint if exists track_groups_accent_hex_valid;
alter table track_groups
  add constraint track_groups_accent_hex_valid check (
    accent_hex is null or accent_hex ~ '^#[0-9a-fA-F]{6}$'
  );

alter table track_groups
  drop constraint if exists track_groups_accent_color_valid;
alter table track_groups
  add constraint track_groups_accent_color_valid check (
    accent_color is null
    or accent_color in ('ice', 'amber', 'violet', 'ok', 'warn', 'custom')
  );
