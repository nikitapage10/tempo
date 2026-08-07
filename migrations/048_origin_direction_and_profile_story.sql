-- TEMPO migration 048: Origin direction and artist-owned profile stories
-- Additive only. Run in Supabase SQL Editor after migration 047.
-- No rows are deleted, no visibility changes, and existing backstory remains intact.

alter table artist_origins
  add column if not exists direction_text text,
  add column if not exists story_sections jsonb not null default '[]'::jsonb;

alter table artist_profiles
  add column if not exists story_sections jsonb not null default '[]'::jsonb;

create or replace function profile_story_sections_valid(sections jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(sections) = 'array'
    and jsonb_array_length(sections) <= 8
    and coalesce(bool_and(
      jsonb_typeof(item.value) = 'object'
      and item.value ? 'title'
      and item.value ? 'body'
      and jsonb_typeof(item.value->'title') = 'string'
      and jsonb_typeof(item.value->'body') = 'string'
      and char_length(item.value->>'title') <= 120
      and char_length(item.value->>'body') <= 2000
      and (
        char_length(trim(item.value->>'title')) > 0
        or char_length(trim(item.value->>'body')) > 0
      )
    ), true)
  from jsonb_array_elements(sections) as item;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'artist_origins_direction_len'
  ) then
    alter table artist_origins add constraint artist_origins_direction_len
      check (direction_text is null or char_length(direction_text) <= 4000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'artist_origins_story_sections_valid'
  ) then
    alter table artist_origins add constraint artist_origins_story_sections_valid
      check (profile_story_sections_valid(story_sections));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'artist_profiles_story_sections_valid'
  ) then
    alter table artist_profiles add constraint artist_profiles_story_sections_valid
      check (profile_story_sections_valid(story_sections));
  end if;
end $$;

-- A new function name keeps migration 042's completion function intact for
-- older deployed clients while the current app stores the added direction and
-- modular story in the same transaction.
create or replace function complete_artist_origin_v2(
  p_artist_id uuid,
  p_artist_name text,
  p_introduction text,
  p_direction text,
  p_artist_promise text,
  p_creative_compass text,
  p_identity_signals jsonb,
  p_chapter_title text,
  p_chapter_premise text,
  p_story_sections jsonb,
  p_suggested_genres text[],
  p_suggested_roles text[]
)
returns artist_origins
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row artist_origins;
  v_name text := nullif(trim(p_artist_name), '');
begin
  if not exists (
    select 1 from artists a where a.id = p_artist_id and a.user_id = auth.uid()
  ) then
    raise exception 'artist not found' using errcode = 'insufficient_privilege';
  end if;

  insert into artist_origins as ao (
    artist_id, user_id, status, current_step,
    artist_name_draft, introduction_text, direction_text,
    artist_promise, creative_compass, identity_signals,
    current_chapter_title, current_chapter_premise, story_sections,
    suggested_genres, suggested_roles,
    generation_version, generated_at, completed_at
  ) values (
    p_artist_id, auth.uid(), 'complete', 'complete',
    v_name, p_introduction, p_direction,
    p_artist_promise, p_creative_compass, coalesce(p_identity_signals, '[]'::jsonb),
    p_chapter_title, p_chapter_premise, coalesce(p_story_sections, '[]'::jsonb),
    coalesce(p_suggested_genres, '{}'), coalesce(p_suggested_roles, '{}'),
    3, now(), now()
  )
  on conflict (artist_id) do update set
    status = 'complete',
    current_step = 'complete',
    artist_name_draft = excluded.artist_name_draft,
    introduction_text = excluded.introduction_text,
    direction_text = excluded.direction_text,
    artist_promise = excluded.artist_promise,
    creative_compass = excluded.creative_compass,
    identity_signals = excluded.identity_signals,
    current_chapter_title = excluded.current_chapter_title,
    current_chapter_premise = excluded.current_chapter_premise,
    story_sections = excluded.story_sections,
    suggested_genres = excluded.suggested_genres,
    suggested_roles = excluded.suggested_roles,
    generation_version = 3,
    generated_at = now(),
    completed_at = coalesce(ao.completed_at, now())
  returning * into v_row;

  update artists
     set name = coalesce(v_name, name),
         origin_status = 'complete',
         origin_completed_at = coalesce(origin_completed_at, now())
   where id = p_artist_id and user_id = auth.uid();

  return v_row;
end $$;
