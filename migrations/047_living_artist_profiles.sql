-- TEMPO migration 047 — living artist profiles
-- Additive only. Run in Supabase SQL Editor. Drops nothing, rewrites nothing,
-- and does not alter profile visibility or any RLS policy.
--
-- Adds the structured, deliberately publishable parts of Coming Into Focus:
-- a small sound spectrum, the artist's present direction, and external music
-- the artist explicitly chooses to feature.

alter table artist_profiles
  add column if not exists sound_markers jsonb not null default '[]'::jsonb,
  add column if not exists current_focus_title text,
  add column if not exists current_focus_body text,
  add column if not exists featured_music jsonb not null default '[]'::jsonb;

create or replace function profile_sound_markers_valid(markers jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(markers) = 'array'
    and jsonb_array_length(markers) <= 5
    and coalesce(bool_and(
      jsonb_typeof(item.value) = 'object'
      and item.value ? 'label'
      and item.value ? 'description'
      and jsonb_typeof(item.value->'label') = 'string'
      and jsonb_typeof(item.value->'description') = 'string'
      and char_length(item.value->>'label') between 1 and 60
      and char_length(item.value->>'description') <= 300
    ), true)
  from jsonb_array_elements(markers) as item;
$$;

create or replace function profile_featured_music_valid(items jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) <= 6
    and coalesce(bool_and(
      jsonb_typeof(item.value) = 'object'
      and item.value ? 'title'
      and item.value ? 'url'
      and item.value ? 'note'
      and jsonb_typeof(item.value->'title') = 'string'
      and jsonb_typeof(item.value->'url') = 'string'
      and jsonb_typeof(item.value->'note') = 'string'
      and char_length(item.value->>'title') between 1 and 120
      and char_length(item.value->>'url') between 1 and 2000
      and char_length(item.value->>'note') <= 160
    ), true)
  from jsonb_array_elements(items) as item;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'artist_profiles_sound_markers_valid'
  ) then
    alter table artist_profiles add constraint artist_profiles_sound_markers_valid
      check (profile_sound_markers_valid(sound_markers));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'artist_profiles_featured_music_valid'
  ) then
    alter table artist_profiles add constraint artist_profiles_featured_music_valid
      check (profile_featured_music_valid(featured_music));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'artist_profiles_current_focus_title_len'
  ) then
    alter table artist_profiles add constraint artist_profiles_current_focus_title_len
      check (current_focus_title is null or char_length(current_focus_title) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'artist_profiles_current_focus_body_len'
  ) then
    alter table artist_profiles add constraint artist_profiles_current_focus_body_len
      check (current_focus_body is null or char_length(current_focus_body) <= 1000);
  end if;
end $$;
