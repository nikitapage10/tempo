-- TEMPO migration 028 — artist profiles (public identity layer) + social security kernel
-- Additive only. Run in Supabase SQL Editor. Drops nothing, rewrites nothing.
--
-- This is the first migration in TEMPO's social layer. It introduces the
-- product's first genuine cross-user READ path, so it's built around one
-- rule that every migration from here on must keep:
--
--   No migration numbered 028 or higher may alter a policy on a table that
--   existed at 027. Public identity lives in its own table instead of on
--   `artists`, so the blast radius of a mistake here stays inside the
--   tables this migration (and the ones after it) creates.
--
-- `artists` itself is untouched — it keeps its existing `own_artists using
-- (user_id = auth.uid())` policy, unmodified, and is never joined by a
-- social-table policy. `artist_profiles` mirrors the handful of identity
-- fields that need to be publicly visible (name, emblem, banner, palette)
-- via an AFTER UPDATE trigger, so it is self-sufficient — every future
-- social table foreign-keys `artist_profiles`, never `artists`.

-- ---------- artist_profiles ----------

create table if not exists artist_profiles (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null unique references artists(id) on delete cascade,
  -- Denormalized so every social RLS policy can answer "do I own this?"
  -- without joining `artists` (whose own policy would then be evaluated).
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- Secondary identity (Discord model) — the artist NAME is the prominent
  -- one everywhere in the UI; the handle only surfaces for share links and
  -- @mentions. Nullable: a profile can exist unpublished with no handle yet.
  handle text unique,

  -- Mirrored from `artists` by trigger below — this table never needs to
  -- join `artists` to render.
  display_name text not null,
  emblem_url text,
  banner_url text,
  banner_color text,
  banner_color_end text,
  ice_color text,
  amber_color text,
  palette_id text not null default 'spectra',

  -- Profile-only content.
  tagline text,
  bio text,
  backstory text,
  location text,
  country_code text,
  genres text[] not null default '{}',
  roles text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,
  pronouns text,

  -- Visibility ladder. 'private' = owner only (default — publishing is a
  -- deliberate act). 'members' = any signed-in TEMPO user. 'public'
  -- additionally exposes the unauthenticated shareable /p/[handle] link.
  visibility text not null default 'private'
    check (visibility in ('private', 'members', 'public')),
  published_at timestamptz,

  accepts_dms text not null default 'connections'
    check (accepts_dms in ('anyone', 'connections', 'nobody')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint artist_profiles_handle_shape check (
    handle is null
    or (handle = lower(handle)
        and handle ~ '^[a-z0-9_.]{3,30}$'
        and handle !~ '^[._]'
        and handle !~ '[._]$')
  ),
  constraint artist_profiles_bio_len check (bio is null or char_length(bio) <= 2000),
  constraint artist_profiles_backstory_len check (backstory is null or char_length(backstory) <= 8000),
  constraint artist_profiles_tagline_len check (tagline is null or char_length(tagline) <= 140),
  constraint artist_profiles_links_len check (jsonb_array_length(links) <= 12),
  constraint artist_profiles_genres_len check (array_length(genres, 1) is null or array_length(genres, 1) <= 8),
  constraint artist_profiles_roles_len check (array_length(roles, 1) is null or array_length(roles, 1) <= 8),
  -- A profile can only leave 'private' once it has a published_at set — keeps
  -- the timestamp meaningful and gives the UI something to sort discovery by.
  constraint artist_profiles_published_consistent check (
    visibility = 'private' or published_at is not null
  )
);

create index if not exists idx_artist_profiles_owner on artist_profiles (owner_user_id);
create index if not exists idx_artist_profiles_visible
  on artist_profiles (visibility, published_at desc) where visibility <> 'private';
create index if not exists idx_artist_profiles_handle
  on artist_profiles (handle) where handle is not null;

-- Directory search (used from Phase 2 onward) — trigram match on display name.
create extension if not exists pg_trgm;
create index if not exists idx_artist_profiles_name_trgm
  on artist_profiles using gin (display_name gin_trgm_ops);

drop trigger if exists trg_artist_profiles_updated_at on artist_profiles;
create or replace function touch_artist_profiles_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_artist_profiles_updated_at before update on artist_profiles
  for each row execute function touch_artist_profiles_updated_at();

-- ---------- reserved handles ----------
-- Keeps route segments like /p/settings or /p/api from ever being shadowed
-- by a user's chosen handle.

create table if not exists reserved_handles (
  handle text primary key
);

insert into reserved_handles (handle) values
  ('admin'), ('api'), ('app'), ('auth'), ('login'), ('register'), ('settings'),
  ('review'), ('invite'), ('p'), ('feed'), ('messages'), ('notifications'),
  ('tempo'), ('support'), ('help'), ('about'), ('new'), ('me'), ('social'),
  ('artist'), ('stats'), ('track'), ('tracks'), ('projects'), ('tasks'), ('board')
on conflict do nothing;

create or replace function check_handle_not_reserved() returns trigger
language plpgsql as $$
begin
  if new.handle is not null
     and exists (select 1 from reserved_handles r where r.handle = new.handle) then
    raise exception 'That handle is reserved.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_not_reserved on artist_profiles;
create trigger trg_handle_not_reserved before insert or update of handle
  on artist_profiles for each row execute function check_handle_not_reserved();

-- ---------- identity mirror from artists ----------
-- Keeps artist_profiles self-sufficient: rendering a profile (private or
-- public) never needs to touch `artists`, so its RLS is never evaluated by
-- a social read path.

create or replace function sync_artist_profile_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update artist_profiles p set
    display_name     = new.name,
    emblem_url       = new.emblem_url,
    banner_url       = new.banner_url,
    banner_color     = new.banner_color,
    banner_color_end = new.banner_color_end,
    ice_color        = new.ice_color,
    amber_color      = new.amber_color,
    palette_id       = new.palette_id
  where p.artist_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_artist_profile_identity on artists;
create trigger trg_sync_artist_profile_identity after update on artists
  for each row execute function sync_artist_profile_identity();

-- ---------- security kernel ----------
-- Every helper below is `stable`, takes only IDs, returns only a boolean or
-- the caller's own rows, and is revoked from `anon`/`public` by default.
-- Rule for every migration from here on: any subquery inside a policy or
-- trigger that must see rows the caller doesn't own goes through one of
-- these (or a new one shaped like them) — an RLS-filtered subquery inside a
-- policy silently evaluates to "no rows" rather than raising, which turns a
-- guard into a no-op. See SECURITY-AND-PERMISSIONS.md.

create or replace function my_profile_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id from artist_profiles p where p.owner_user_id = auth.uid();
$$;

create or replace function owns_profile(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artist_profiles p
    where p.id = p_profile_id and p.owner_user_id = auth.uid()
  );
$$;

-- Can the signed-in caller see this profile's public surface? Migration 029
-- replaces this definition (create or replace) to also exclude blocked
-- profiles once profile_blocks exists — that replacement is not a no-op.
create or replace function profile_is_readable(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artist_profiles p
    where p.id = p_profile_id
      and (
        p.owner_user_id = auth.uid()
        or (p.visibility in ('members', 'public') and auth.uid() is not null)
      )
  );
$$;

revoke execute on function my_profile_ids() from public, anon;
revoke execute on function owns_profile(uuid) from public, anon;
revoke execute on function profile_is_readable(uuid) from public, anon;
grant execute on function my_profile_ids() to authenticated;
grant execute on function owns_profile(uuid) to authenticated;
grant execute on function profile_is_readable(uuid) to authenticated;

-- ---------- artist_profiles RLS ----------
-- `to authenticated` on every policy is the load-bearing detail: the `anon`
-- role gets no policy on this table at all, so an unauthenticated request
-- reads nothing regardless of the `using` expression. The public /p/[handle]
-- link is deliberately a server route with the service-role client instead
-- (see lib/public-profile-server.ts) rather than an anon SELECT policy, so
-- every future column added here doesn't become world-readable by default.

alter table artist_profiles enable row level security;
alter table reserved_handles enable row level security;

drop policy if exists read_artist_profiles on artist_profiles;
create policy read_artist_profiles on artist_profiles for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or visibility in ('members', 'public')
  );

-- The one deliberate place `artists` RLS fires for a social table: proving
-- the caller owns the artist they're creating a profile for.
drop policy if exists insert_artist_profiles on artist_profiles;
create policy insert_artist_profiles on artist_profiles for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  );

drop policy if exists update_artist_profiles on artist_profiles;
create policy update_artist_profiles on artist_profiles for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists delete_artist_profiles on artist_profiles;
create policy delete_artist_profiles on artist_profiles for delete
  to authenticated using (owner_user_id = auth.uid());

drop policy if exists read_reserved_handles on reserved_handles;
create policy read_reserved_handles on reserved_handles for select
  to authenticated using (true);

-- ---------- notifications extension ----------
-- Additive columns on the existing tray from migration 009. One badge, one
-- mark-read path, for both catalog and social notifications going forward.

alter table notifications
  add column if not exists actor_profile_id uuid references artist_profiles(id) on delete set null,
  add column if not exists target_profile_id uuid references artist_profiles(id) on delete cascade,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists link_url text,
  add column if not exists group_key text;

create index if not exists idx_notifications_unread
  on notifications (user_id, created_at desc) where read_at is null;
create index if not exists idx_notifications_group
  on notifications (user_id, group_key, created_at desc) where group_key is not null;

-- The only sanctioned cross-tenant write in the social layer: writes exactly
-- one row into one table, and takes its recipient from server-trusted data
-- (the target profile's owner), never from client input. Revoked from
-- `authenticated` as well as `anon`/`public` — it is called only from
-- triggers (which run with the trigger function's own privileges), never
-- over RPC, so a caller can never spam another user's notification tray.
create or replace function notify_profile_owner(
  p_target_profile_id uuid,
  p_actor_profile_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_link_url text default null,
  p_group_key text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select owner_user_id into v_user from artist_profiles where id = p_target_profile_id;
  if v_user is null then return; end if;
  if v_user = auth.uid() then return; end if;
  insert into notifications (
    user_id, type, title, body, actor_profile_id, target_profile_id,
    entity_type, entity_id, link_url, group_key
  ) values (
    v_user, p_type, p_title, p_body, p_actor_profile_id, p_target_profile_id,
    p_entity_type, p_entity_id, p_link_url, p_group_key
  );
end;
$$;

revoke execute on function notify_profile_owner(uuid, uuid, text, text, text, text, uuid, text, text)
  from public, anon, authenticated;
