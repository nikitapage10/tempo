-- TEMPO migration 089 — artist-level team membership (managers, agents, tour managers)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- Collaboration today (migration 009) is track-scoped only — there is no way
-- to give a manager, agent, or tour manager access to an artist as a whole.
-- This table is the artist-scoped analogue of track_collaborators, and
-- deliberately mirrors its shape (invite by email, token-hashed, role +
-- status lifecycle) so the invite/accept mechanics can be reused wholesale.
--
-- This migration only creates the table and its own-row policies — it grants
-- no visibility into any *other* table yet. Migration 090 widens specific
-- read/write policies elsewhere, additively, using the helper functions
-- defined here.

-- A CHECK constraint can't contain a correlated subquery (Postgres rejects
-- it outright), so the areas-shape validation has to be a plain function
-- call instead of the `not exists (select ... from jsonb_each_text(...))`
-- form used elsewhere in this file's design notes — this is that function.
create or replace function is_valid_area_grants(p_areas jsonb) returns boolean
language sql immutable as $$
  select coalesce(
    (select bool_and(value in ('none', 'read', 'write'))
       from jsonb_each_text(p_areas)),
    true
  );
$$;

create table if not exists artist_members (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- null until accepted
  invited_email text,
  role text not null check (role in
    ('manager', 'agent', 'tour_manager', 'label', 'assistant', 'custom')),
  -- Per-area grants after the artist's own edits — the role only supplies
  -- the starting preset (lib/team/roles.ts). Validated shape enforced by the
  -- check below; the closed area/level vocabulary itself lives in
  -- lib/team/areas.ts, not the database.
  areas jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'active', 'revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invite_token_hash text unique,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),

  constraint artist_members_areas_shape check (
    jsonb_typeof(areas) = 'object' and is_valid_area_grants(areas)
  )
);

create index if not exists idx_artist_members_artist
  on artist_members (artist_id);
create index if not exists idx_artist_members_user
  on artist_members (user_id) where status = 'active';
create index if not exists idx_artist_members_email
  on artist_members (invited_email) where status = 'pending';

alter table artist_members enable row level security;

-- Same shape as own_track_collaborators (migration 009): the artist owner
-- manages every row; an already-linked member can read (but not edit) their
-- own row, e.g. to see their own grants.
drop policy if exists own_artist_members on artist_members;
create policy own_artist_members on artist_members for all
  using (
    exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
    or user_id = auth.uid()
  )
  with check (
    exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Non-recursive SECURITY DEFINER helpers — same pattern as
-- is_track_owner()/can_read_track()/can_edit_track() in migration 009, so
-- migration 090's widened policies stay simple and RLS never self-references.
-- ---------------------------------------------------------------------------

create or replace function is_artist_owner(p_artist_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artists a where a.id = p_artist_id and a.user_id = auth.uid()
  );
$$;

create or replace function artist_member_area_level(p_artist_id uuid, p_area text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(m.areas ->> p_area, 'none') from artist_members m
  where m.artist_id = p_artist_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function can_read_artist_area(p_artist_id uuid, p_area text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_artist_owner(p_artist_id)
    or artist_member_area_level(p_artist_id, p_area) in ('read', 'write');
$$;

create or replace function can_write_artist_area(p_artist_id uuid, p_area text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_artist_owner(p_artist_id)
    or artist_member_area_level(p_artist_id, p_area) = 'write';
$$;

/**
 * True if the signed-in user has any active membership at all — used only to
 * widen SELECT on the `artists` row itself in migration 090, so a member can
 * see (and switch into) an artist they don't own without yet having a
 * specific area grant to check.
 */
create or replace function is_artist_member(p_artist_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artist_members m
    where m.artist_id = p_artist_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;
