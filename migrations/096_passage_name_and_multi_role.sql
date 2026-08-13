-- TEMPO migration 096 — Passage opens on a name, and a person can be more
-- than one thing.
-- Additive. Run after 095. Drops nothing, truncates nothing, and weakens no
-- existing policy.
--
-- 094 modelled the role as a single chip. That was wrong for this audience:
-- the same person is routinely a manager *and* a label owner, or a creative
-- director who also shoots. The single value becomes an array, and the flow
-- now asks who they are before asking what they do.

alter table member_passages
  add column if not exists display_name text,
  add column if not exists role_titles text[] not null default '{}',
  -- The closing scroll is written rather than echoed back: TEMPO reads the
  -- answers and reflects them as a short, cohesive story the member can edit.
  add column if not exists headline text,
  add column if not exists intro text,
  add column if not exists story_sections jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'member_passages_display_name_len'
  ) then
    alter table member_passages add constraint member_passages_display_name_len
      check (display_name is null or char_length(display_name) <= 60);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'member_passages_role_titles_count'
  ) then
    alter table member_passages add constraint member_passages_role_titles_count
      check (array_length(role_titles, 1) is null or array_length(role_titles, 1) <= 12);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'member_passages_headline_len'
  ) then
    alter table member_passages add constraint member_passages_headline_len
      check (headline is null or char_length(headline) <= 400);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'member_passages_intro_len'
  ) then
    alter table member_passages add constraint member_passages_intro_len
      check (intro is null or char_length(intro) <= 2000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'member_passages_story_is_array'
  ) then
    alter table member_passages add constraint member_passages_story_is_array
      check (jsonb_typeof(story_sections) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'member_passages_story_count'
  ) then
    alter table member_passages add constraint member_passages_story_count
      check (jsonb_array_length(story_sections) <= 8);
  end if;
end $$;

-- Carry any single answer already given over to the array, so a draft saved
-- before this migration keeps its selection.
update member_passages
set role_titles = array[role_title]
where role_title is not null
  and coalesce(array_length(role_titles, 1), 0) = 0;

-- Two new stable resume points at the front of the flow.
alter table member_passages drop constraint if exists member_passages_current_step_check;
alter table member_passages add constraint member_passages_current_step_check
  check (current_step in (
    'name', 'describe', 'role', 'entry', 'support', 'function', 'look',
    'processing', 'story', 'complete'
  ));

-- 'role' is retained above only so a draft written by the previous build still
-- satisfies the constraint. Point those at the step that replaced it.
update member_passages set current_step = 'describe' where current_step = 'role';

alter table member_passages alter column current_step set default 'name';
