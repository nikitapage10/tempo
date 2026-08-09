-- TEMPO migration 062: Scene V2 appearance composition
-- Depends on 061.

alter table scenes
  add column if not exists banner_focal_x numeric(5,2) not null default 50,
  add column if not exists banner_focal_y numeric(5,2) not null default 50,
  add column if not exists banner_alt text,
  add column if not exists banner_treatment text not null default 'wash',
  add column if not exists default_section_id uuid references scene_sections(id) on delete set null,
  add column if not exists public_summary text,
  add column if not exists rules text,
  add column if not exists timezone text;

alter table scenes drop constraint if exists scenes_banner_focal_x_range;
alter table scenes add constraint scenes_banner_focal_x_range
  check (banner_focal_x between 0 and 100);
alter table scenes drop constraint if exists scenes_banner_focal_y_range;
alter table scenes add constraint scenes_banner_focal_y_range
  check (banner_focal_y between 0 and 100);
alter table scenes drop constraint if exists scenes_banner_treatment_check;
alter table scenes add constraint scenes_banner_treatment_check
  check (banner_treatment in ('wash','cinematic','clean'));
alter table scenes drop constraint if exists scenes_banner_alt_len;
alter table scenes add constraint scenes_banner_alt_len
  check (banner_alt is null or char_length(banner_alt) <= 300);
alter table scenes drop constraint if exists scenes_public_summary_len;
alter table scenes add constraint scenes_public_summary_len
  check (public_summary is null or char_length(public_summary) <= 500);
alter table scenes drop constraint if exists scenes_rules_len;
alter table scenes add constraint scenes_rules_len
  check (rules is null or char_length(rules) <= 12000);

update scenes s set default_section_id = x.id
from scene_sections x
where x.scene_id = s.id and x.slug = 'general' and s.default_section_id is null;
