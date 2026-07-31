-- TEMPO migration 042 — Artist Origin (first-time onboarding)
-- Additive only. Run in Supabase SQL Editor. Drops nothing, truncates nothing,
-- rewrites nothing, and weakens no existing policy.
--
-- Backs ORIGIN: the first-run experience where a new artist says who they are,
-- TEMPO reflects a provisional shape back, and the artist edits and confirms it
-- before anything is kept. Everything here is owner-private. Nothing in this
-- migration can publish a profile or change profile visibility.

-- ---------- Origin status on artists ----------

-- Nullable first so the backfill can run before the not-null lands (same shape
-- as the artist_id backfill in 021).
alter table artists add column if not exists origin_status text;

-- Every artist that predates ORIGIN is legacy-complete: existing users must
-- never be dropped into onboarding for an artist they already built on.
update artists set origin_status = 'legacy_complete' where origin_status is null;

alter table artists
  alter column origin_status set default 'not_started';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'artists_origin_status_valid'
  ) then
    alter table artists add constraint artists_origin_status_valid
      check (origin_status in (
        'not_started','in_progress','complete','skipped','legacy_complete'
      ));
  end if;
end $$;

alter table artists alter column origin_status set not null;

alter table artists add column if not exists origin_completed_at timestamptz;
alter table artists add column if not exists origin_skipped_at timestamptz;

-- ---------- The Origin record ----------

-- One row per artist. Holds the draft while the flow is in progress and the
-- confirmed content afterwards. Plain text and structured JSON only — never
-- generated HTML.
create table if not exists artist_origins (
  artist_id uuid primary key references artists(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  status text not null default 'in_progress'
    check (status in ('in_progress','complete','skipped')),
  -- Stable state to resume on. Never a transition — see the reducer.
  current_step text not null default 'name'
    check (current_step in ('name','introduction','processing','review','story','complete')),

  artist_name_draft text,
  introduction_text text,

  artist_promise text,
  creative_compass text,
  -- [{ label, explanation, evidence, confidence }] — validated below.
  identity_signals jsonb not null default '[]'::jsonb,

  current_chapter_title text,
  current_chapter_premise text,

  suggested_genres text[] not null default '{}',
  suggested_roles text[] not null default '{}',

  -- Bumped when the interpretation prompt/schema changes materially, so old
  -- rows stay readable and re-interpretation is traceable.
  generation_version int not null default 1,
  generated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint artist_origins_name_len
    check (artist_name_draft is null or char_length(artist_name_draft) <= 60),
  constraint artist_origins_intro_len
    check (introduction_text is null or char_length(introduction_text) <= 20000),
  constraint artist_origins_promise_len
    check (artist_promise is null or char_length(artist_promise) <= 400),
  constraint artist_origins_compass_len
    check (creative_compass is null or char_length(creative_compass) <= 2000),
  constraint artist_origins_chapter_title_len
    check (current_chapter_title is null or char_length(current_chapter_title) <= 120),
  constraint artist_origins_chapter_premise_len
    check (current_chapter_premise is null or char_length(current_chapter_premise) <= 2000),
  constraint artist_origins_signals_is_array
    check (jsonb_typeof(identity_signals) = 'array'),
  constraint artist_origins_signals_count
    check (jsonb_array_length(identity_signals) <= 8),
  constraint artist_origins_genres_count
    check (array_length(suggested_genres, 1) is null or array_length(suggested_genres, 1) <= 12),
  constraint artist_origins_roles_count
    check (array_length(suggested_roles, 1) is null or array_length(suggested_roles, 1) <= 12)
);

create index if not exists idx_artist_origins_user on artist_origins (user_id);

-- ---------- Structural validation of identity_signals ----------

-- Kept as a function + constraint rather than a jsonb schema extension, which
-- Supabase does not ship. Rejects anything the review UI could not render.
create or replace function artist_origins_signals_valid(signals jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(
    jsonb_typeof(s.value) = 'object'
    and s.value ? 'label'
    and s.value ? 'explanation'
    and s.value ? 'evidence'
    and s.value ? 'confidence'
    and jsonb_typeof(s.value->'label') = 'string'
    and jsonb_typeof(s.value->'explanation') = 'string'
    and jsonb_typeof(s.value->'evidence') = 'string'
    and s.value->>'confidence' in ('high','medium','low')
    and char_length(s.value->>'label') between 1 and 80
    and char_length(s.value->>'explanation') <= 600
    and char_length(s.value->>'evidence') <= 600
  ), true)
  from jsonb_array_elements(signals) as s;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'artist_origins_signals_shape'
  ) then
    alter table artist_origins add constraint artist_origins_signals_shape
      check (artist_origins_signals_valid(identity_signals));
  end if;
end $$;

-- ---------- Ownership integrity ----------

-- The row's user_id must agree with the owner of the artist it points at.
-- Without this, a caller could insert a row for their own user_id against
-- somebody else's artist_id and the RLS policy below would still pass.
create or replace function artist_origins_owner_matches(p_artist_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from artists a where a.id = p_artist_id and a.user_id = p_user_id
  );
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'artist_origins_owner_consistent'
  ) then
    alter table artist_origins add constraint artist_origins_owner_consistent
      check (artist_origins_owner_matches(artist_id, user_id));
  end if;
end $$;

-- ---------- RLS ----------

alter table artist_origins enable row level security;

-- Owner-only, matching the shape of own_artists in 021. The artists subquery is
-- what stops a guessed artist UUID from another account being readable: both
-- the row's user_id and the artist's user_id must be the caller.
drop policy if exists own_artist_origins on artist_origins;
create policy own_artist_origins on artist_origins for all
  using (
    user_id = auth.uid()
    and exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  );

-- ---------- updated_at ----------

create or replace function touch_artist_origins()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_artist_origins on artist_origins;
create trigger trg_touch_artist_origins
  before update on artist_origins
  for each row execute function touch_artist_origins();

-- ---------- Idempotent completion ----------

-- One transaction: verify ownership, store the confirmed content, rename the
-- artist, mark Origin complete. Safe to call twice — a second call with the
-- same payload lands on the same state and does not move completed_at.
--
-- Deliberately does NOT touch artist_profiles. Publishing, visibility and
-- Social stay exactly where the artist left them; the optional private profile
-- mapping in the final step goes through the existing profile API instead.
create or replace function complete_artist_origin(
  p_artist_id uuid,
  p_artist_name text,
  p_introduction text,
  p_artist_promise text,
  p_creative_compass text,
  p_identity_signals jsonb,
  p_chapter_title text,
  p_chapter_premise text,
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
    artist_name_draft, introduction_text,
    artist_promise, creative_compass, identity_signals,
    current_chapter_title, current_chapter_premise,
    suggested_genres, suggested_roles,
    completed_at
  ) values (
    p_artist_id, auth.uid(), 'complete', 'complete',
    v_name, p_introduction,
    p_artist_promise, p_creative_compass, coalesce(p_identity_signals, '[]'::jsonb),
    p_chapter_title, p_chapter_premise,
    coalesce(p_suggested_genres, '{}'), coalesce(p_suggested_roles, '{}'),
    now()
  )
  on conflict (artist_id) do update set
    status = 'complete',
    current_step = 'complete',
    artist_name_draft = excluded.artist_name_draft,
    introduction_text = excluded.introduction_text,
    artist_promise = excluded.artist_promise,
    creative_compass = excluded.creative_compass,
    identity_signals = excluded.identity_signals,
    current_chapter_title = excluded.current_chapter_title,
    current_chapter_premise = excluded.current_chapter_premise,
    suggested_genres = excluded.suggested_genres,
    suggested_roles = excluded.suggested_roles,
    -- Preserved on a repeat call so the first completion time stands.
    completed_at = coalesce(ao.completed_at, now())
  returning * into v_row;

  update artists
     set name = coalesce(v_name, name),
         origin_status = 'complete',
         origin_completed_at = coalesce(origin_completed_at, now())
   where id = p_artist_id and user_id = auth.uid();

  return v_row;
end $$;

-- ---------- Skip ----------

create or replace function skip_artist_origin(p_artist_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from artists a where a.id = p_artist_id and a.user_id = auth.uid()
  ) then
    raise exception 'artist not found' using errcode = 'insufficient_privilege';
  end if;

  -- The draft is deliberately left intact so "Skip for now" loses nothing.
  update artist_origins set status = 'skipped' where artist_id = p_artist_id;

  update artists
     set origin_status = 'skipped',
         origin_skipped_at = coalesce(origin_skipped_at, now())
   where id = p_artist_id and user_id = auth.uid();
end $$;
