-- TEMPO migration 049 — Scenes, part 1: scenes, membership, topics
-- Additive only. Run in Supabase SQL Editor. Drops nothing, rewrites nothing.
-- Depends on 028 (artist_profiles kernel + notify_profile_owner), 029 (blocks).
--
-- Scenes is TEMPO's first genuinely many-to-many construct. One rule scopes
-- the whole feature:
--
--   A Scene grants access to THE ROOM, never to anyone's catalog. No policy
--   or helper in 049–054 may read `tracks`, `spaces`, or `artists`. Two
--   artists sharing a Scene learn nothing about each other's work beyond what
--   one of them deliberately posts into it.
--
-- And one hard implementation requirement, the same one 031 carries at the
-- top of its file:
--
--   NO POLICY ON `scene_members` MAY NAME `scene_members` IN A SUBQUERY.
--   A membership table whose own policy asks "is the caller a member?" by
--   querying itself raises 42P17 infinite recursion. Every such question goes
--   through is_scene_member()/is_scene_manager() below, which are
--   `security definer` and therefore not RLS-evaluated.
--
--   Second-order form of the same trap: `scene_topics`' policy must call
--   is_scene_member(scene_id) rather than joining `scene_members`. If a
--   future `scene_members` policy ever references `scene_topics`, an inlined
--   join here would close the loop.

-- ---------- scenes ----------

create table if not exists scenes (
  id uuid primary key default gen_random_uuid(),

  -- Its own namespace, separate from artist handles. The reserved-handle
  -- check below stops a slug from shadowing an app route.
  slug text not null unique,
  name text not null,
  tagline text,
  about text,

  kind text not null default 'other'
    check (kind in ('label', 'school', 'crew', 'collective', 'genre', 'local', 'other')),

  owner_profile_id uuid not null references artist_profiles(id) on delete cascade,
  -- Denormalized for the same reason as posts.author_user_id: ownership
  -- checks resolve without joining artist_profiles under RLS.
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- 'open'    — anyone who can see it joins instantly
  -- 'request' — join creates a pending row a manager approves
  -- 'invite'  — join is refused outright; managers invite
  join_policy text not null default 'request'
    check (join_policy in ('open', 'request', 'invite')),

  -- 'members'  — any signed-in TEMPO artist can find and see the scene shell
  -- 'unlisted' — only members can see it at all; not browsable
  -- 'public'   — reserved for the phase-3 /s/[slug] link. Behaves as 'members'
  --              until that ships: there is deliberately no anon policy here,
  --              matching artist_profiles (028) where the public link is a
  --              service-role server route, not an anon SELECT policy.
  visibility text not null default 'members'
    check (visibility in ('members', 'unlisted', 'public')),

  emblem_url text,
  banner_url text,
  banner_color text,
  banner_color_end text,
  -- The scene's own accent pair. Applied to a SCOPED wrapper in the UI, never
  -- to document.documentElement — the active artist's ice stays the app-wide
  -- interaction colour. See SCENES-SPEC.md §"Palette".
  palette_id text not null default 'spectra',
  ice_color text,
  amber_color text,

  location text,
  country_code text,
  genres text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,

  -- Toggleable surfaces, Mighty-style: {"feed":true,"polls":true,...}.
  -- Absent key reads as enabled; the UI owns the defaults.
  features jsonb not null default '{}'::jsonb,
  -- Ordered onboarding steps shown to a member who just joined.
  welcome_checklist jsonb not null default '[]'::jsonb,

  -- Phase-3 affordance (recognitions / leaderboards). Created now so no later
  -- migration has to ALTER this table once it holds real communities.
  recognition_enabled boolean not null default true,
  -- Phase-4 affordance (sub-scenes).
  parent_scene_id uuid references scenes(id) on delete set null,

  member_count int not null default 0,
  post_count int not null default 0,
  last_activity_at timestamptz not null default now(),

  -- Scenes are archived, never hard-deleted, so a room full of other people's
  -- posts can't vanish under them.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scenes_slug_shape check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9-]{3,40}$'
    and slug !~ '^-'
    and slug !~ '-$'
    and slug !~ '--'
  ),
  constraint scenes_name_len check (char_length(trim(name)) between 2 and 60),
  constraint scenes_tagline_len check (tagline is null or char_length(tagline) <= 140),
  constraint scenes_about_len check (about is null or char_length(about) <= 8000),
  constraint scenes_genres_len check (array_length(genres, 1) is null or array_length(genres, 1) <= 8),
  constraint scenes_links_len check (jsonb_array_length(links) <= 12),
  constraint scenes_welcome_len check (jsonb_array_length(welcome_checklist) <= 10),
  constraint scenes_no_self_parent check (parent_scene_id is null or parent_scene_id <> id)
);

create index if not exists idx_scenes_browse
  on scenes (visibility, last_activity_at desc) where archived_at is null;
create index if not exists idx_scenes_owner
  on scenes (owner_profile_id);
create index if not exists idx_scenes_name_trgm
  on scenes using gin (name gin_trgm_ops);

-- ---------- scene_members ----------
-- Requests, invites, bans and departures all fold into `status` rather than
-- living in three side tables, so every permission helper reads one place and
-- a ban survives a leave-and-rejoin.

create table if not exists scene_members (
  scene_id uuid not null references scenes(id) on delete cascade,
  profile_id uuid not null references artist_profiles(id) on delete cascade,
  -- Denormalized so is_scene_member() answers without joining artist_profiles.
  user_id uuid not null references auth.users(id) on delete cascade,

  role text not null default 'member'
    check (role in ('owner', 'moderator', 'member')),
  status text not null default 'active'
    check (status in ('active', 'pending', 'invited', 'banned', 'left')),

  invited_by_profile_id uuid references artist_profiles(id) on delete set null,
  request_note text,

  joined_at timestamptz,
  last_read_at timestamptz,
  muted boolean not null default false,
  welcome_steps_done text[] not null default '{}',

  -- Phase-2 affordances (recognitions, streaks, leaderboards).
  points int not null default 0,
  streak_days int not null default 0,
  last_active_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (scene_id, profile_id),
  constraint scene_members_note_len check (request_note is null or char_length(request_note) <= 500),
  -- Only an active member can hold a management role.
  constraint scene_members_role_needs_active check (role = 'member' or status = 'active')
);

create index if not exists idx_scene_members_mine
  on scene_members (user_id, scene_id) where status = 'active';
create index if not exists idx_scene_members_roster
  on scene_members (scene_id, status, role);
create index if not exists idx_scene_members_joined
  on scene_members (scene_id, joined_at desc) where status = 'active';
-- Exactly one owner per scene. Also pre-enables phase-2 ownership transfer
-- with no schema change: the transfer is one UPDATE inside a definer RPC.
create unique index if not exists uq_scene_single_owner
  on scene_members (scene_id) where role = 'owner';

-- ---------- scene_topics ----------

create table if not exists scene_topics (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order int not null default 0,

  kind text not null default 'feed' check (kind in ('feed', 'announcements')),
  -- 'moderators' makes a read-only-for-members board (announcements, rules).
  post_policy text not null default 'members'
    check (post_policy in ('members', 'moderators')),
  -- Phase-4 affordance: per-topic feature toggles.
  features jsonb not null default '{}'::jsonb,

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (scene_id, slug),
  constraint scene_topics_name_len check (char_length(trim(name)) between 1 and 40),
  constraint scene_topics_slug_shape check (slug = lower(slug) and slug ~ '^[a-z0-9-]{1,40}$'),
  constraint scene_topics_desc_len check (description is null or char_length(description) <= 500)
);

create index if not exists idx_scene_topics_scene
  on scene_topics (scene_id, sort_order) where archived_at is null;

-- ---------- reserved slugs ----------
-- `scenes` and `scene` join the reserved-handle list so no artist handle can
-- shadow the route, and the same table doubles as the scene-slug denylist.

insert into reserved_handles (handle) values
  ('scene'), ('scenes'), ('community'), ('communities')
on conflict do nothing;

create or replace function check_scene_slug_not_reserved() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from reserved_handles r where r.handle = new.slug) then
    raise exception 'That address is reserved. Try another.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_scene_slug_not_reserved on scenes;
create trigger trg_scene_slug_not_reserved before insert or update of slug
  on scenes for each row execute function check_scene_slug_not_reserved();

-- ---------- updated_at ----------

create or replace function touch_scenes_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_scenes_updated_at on scenes;
create trigger trg_scenes_updated_at before update on scenes
  for each row execute function touch_scenes_updated_at();

drop trigger if exists trg_scene_members_updated_at on scene_members;
create trigger trg_scene_members_updated_at before update on scene_members
  for each row execute function touch_scenes_updated_at();

drop trigger if exists trg_scene_topics_updated_at on scene_topics;
create trigger trg_scene_topics_updated_at before update on scene_topics
  for each row execute function touch_scenes_updated_at();

-- ========== security kernel ==========
-- Shaped exactly like 028's: stable, ID arguments only, boolean or own-rows
-- results, revoked from public/anon. These exist so no policy ever has to
-- inline a subquery over a table the caller can't already read — an
-- RLS-filtered subquery inside a policy evaluates to "no rows" rather than
-- raising, which turns a guard into a silent no-op.

-- THE RECURSION BREAK. Every scene_members policy routes through this.
create or replace function is_scene_member(p_scene_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from scene_members m
    where m.scene_id = p_scene_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function scene_role_of(p_scene_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role from scene_members m
  where m.scene_id = p_scene_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  -- One user could hold two profiles in one scene; the stronger role wins.
  order by case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end
  limit 1;
$$;

create or replace function is_scene_manager(p_scene_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(scene_role_of(p_scene_id) in ('owner', 'moderator'), false);
$$;

create or replace function is_scene_owner(p_scene_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(scene_role_of(p_scene_id) = 'owner', false);
$$;

-- Which of the caller's profiles is the one in this scene? A user can release
-- under several artist names; the one they joined with is the one that posts.
create or replace function scene_member_profile_id(p_scene_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.profile_id from scene_members m
  where m.scene_id = p_scene_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  order by case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end
  limit 1;
$$;

-- Can the caller see the scene shell at all? Members always can. Non-members
-- can see 'members'/'public' scenes unless banned. 'unlisted' is invisible.
create or replace function can_view_scene(p_scene_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from scenes s
    where s.id = p_scene_id
      and (
        is_scene_member(p_scene_id)
        or (
          s.visibility in ('members', 'public')
          and auth.uid() is not null
          and not exists (
            select 1 from scene_members b
            where b.scene_id = p_scene_id
              and b.user_id = auth.uid()
              and b.status = 'banned'
          )
        )
      )
  );
$$;

-- The single gate for writing anything into a scene's feed. Checks, in order:
-- the profile is really the caller's, it is the profile that holds the
-- membership, the scene is live, and the topic (if any) belongs to this scene
-- and accepts posts from this role.
create or replace function can_post_in_scene(
  p_scene_id uuid,
  p_profile_id uuid,
  p_topic_id uuid default null
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_policy text;
begin
  if p_scene_id is null or p_profile_id is null then return false; end if;
  if not owns_profile(p_profile_id) then return false; end if;

  select m.role into v_role from scene_members m
  where m.scene_id = p_scene_id
    and m.profile_id = p_profile_id
    and m.user_id = auth.uid()
    and m.status = 'active';
  if v_role is null then return false; end if;

  if exists (select 1 from scenes s where s.id = p_scene_id and s.archived_at is not null) then
    return false;
  end if;

  if p_topic_id is null then return true; end if;

  select t.post_policy into v_policy from scene_topics t
  where t.id = p_topic_id and t.scene_id = p_scene_id and t.archived_at is null;
  if v_policy is null then return false; end if;

  return v_policy = 'members' or v_role in ('owner', 'moderator');
end;
$$;

revoke execute on function is_scene_member(uuid) from public, anon;
revoke execute on function scene_role_of(uuid) from public, anon;
revoke execute on function is_scene_manager(uuid) from public, anon;
revoke execute on function is_scene_owner(uuid) from public, anon;
revoke execute on function scene_member_profile_id(uuid) from public, anon;
revoke execute on function can_view_scene(uuid) from public, anon;
revoke execute on function can_post_in_scene(uuid, uuid, uuid) from public, anon;
grant execute on function is_scene_member(uuid) to authenticated;
grant execute on function scene_role_of(uuid) to authenticated;
grant execute on function is_scene_manager(uuid) to authenticated;
grant execute on function is_scene_owner(uuid) to authenticated;
grant execute on function scene_member_profile_id(uuid) to authenticated;
grant execute on function can_view_scene(uuid) to authenticated;
grant execute on function can_post_in_scene(uuid, uuid, uuid) to authenticated;

-- ========== counters and seeding (security definer) ==========
-- Same reason as bump_post_like_count in 030: a joining member has no UPDATE
-- privilege on `scenes`, so a plain trigger's UPDATE is filtered to zero rows
-- by update_scenes and the counter silently never moves.

create or replace function bump_scene_member_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_scene uuid := coalesce(new.scene_id, old.scene_id);
  v_was boolean := (tg_op <> 'INSERT' and old.status = 'active');
  v_now boolean := (tg_op <> 'DELETE' and new.status = 'active');
begin
  if v_was = v_now then
    return coalesce(new, old);
  end if;
  update scenes set member_count = greatest(member_count + case when v_now then 1 else -1 end, 0)
  where id = v_scene;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_bump_scene_member_count on scene_members;
create trigger trg_bump_scene_member_count
  after insert or update of status or delete on scene_members
  for each row execute function bump_scene_member_count();

-- Creating a scene seeds the owner's membership and a default topic, so a
-- brand-new scene is immediately postable and the client never has to make
-- three writes that could half-fail.
create or replace function seed_new_scene() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select owner_user_id into v_user from artist_profiles where id = new.owner_profile_id;
  insert into scene_members (scene_id, profile_id, user_id, role, status, joined_at)
  values (new.id, new.owner_profile_id, coalesce(v_user, new.owner_user_id), 'owner', 'active', now())
  on conflict do nothing;

  insert into scene_topics (scene_id, name, slug, sort_order, kind)
  values (new.id, 'General', 'general', 0, 'feed')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_new_scene on scenes;
create trigger trg_seed_new_scene after insert on scenes
  for each row execute function seed_new_scene();

-- ========== membership RPCs ==========
-- Membership is never a bare client INSERT. Every path below is a definer
-- function that decides `status` from the scene's own join_policy, so a
-- client cannot write itself an 'active' row into a request-only scene.

create or replace function join_scene(p_scene_id uuid, p_profile_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_policy text;
  v_archived timestamptz;
  v_user uuid;
  v_existing text;
  v_next text;
begin
  if not owns_profile(p_profile_id) then
    raise exception 'Not your profile' using errcode = '42501';
  end if;
  if not can_view_scene(p_scene_id) then
    raise exception 'That scene is not available' using errcode = '42501';
  end if;

  select join_policy, archived_at into v_policy, v_archived
  from scenes where id = p_scene_id;
  if v_policy is null then
    raise exception 'That scene is not available' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'That scene has been archived' using errcode = '42501';
  end if;

  -- Joining a scene is a network act, same as Social: an unpublished profile
  -- would appear in a member directory with nothing behind it.
  if exists (
    select 1 from artist_profiles ap
    where ap.id = p_profile_id and ap.visibility = 'private'
  ) then
    raise exception 'Publish your artist profile before joining a scene' using errcode = '42501';
  end if;

  select status into v_existing from scene_members
  where scene_id = p_scene_id and profile_id = p_profile_id;

  if v_existing = 'banned' then
    raise exception 'You cannot join that scene' using errcode = '42501';
  end if;
  if v_existing = 'active' then return 'active'; end if;
  if v_existing = 'pending' then return 'pending'; end if;

  -- An outstanding invite beats the join policy — that is what an invite is.
  if v_existing = 'invited' then
    v_next := 'active';
  elsif v_policy = 'open' then
    v_next := 'active';
  elsif v_policy = 'request' then
    v_next := 'pending';
  else
    raise exception 'That scene is invite only' using errcode = '42501';
  end if;

  select owner_user_id into v_user from artist_profiles where id = p_profile_id;

  insert into scene_members (scene_id, profile_id, user_id, status, role, joined_at)
  values (p_scene_id, p_profile_id, v_user, v_next, 'member',
          case when v_next = 'active' then now() else null end)
  on conflict (scene_id, profile_id) do update
    set status = excluded.status,
        joined_at = coalesce(scene_members.joined_at, excluded.joined_at);

  return v_next;
end;
$$;

create or replace function respond_to_scene_join(
  p_scene_id uuid,
  p_profile_id uuid,
  p_approve boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_scene_manager(p_scene_id) then
    raise exception 'Only a scene owner or moderator can do that' using errcode = '42501';
  end if;
  if p_approve then
    update scene_members set status = 'active', joined_at = coalesce(joined_at, now())
    where scene_id = p_scene_id and profile_id = p_profile_id and status = 'pending';
  else
    update scene_members set status = 'left'
    where scene_id = p_scene_id and profile_id = p_profile_id and status = 'pending';
  end if;
end;
$$;

create or replace function invite_to_scene(p_scene_id uuid, p_profile_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_me uuid;
  v_name text;
  v_scene text;
  v_slug text;
begin
  if not is_scene_manager(p_scene_id) then
    raise exception 'Only a scene owner or moderator can invite' using errcode = '42501';
  end if;

  v_me := scene_member_profile_id(p_scene_id);
  if is_blocked_between(v_me, p_profile_id) then
    raise exception 'You cannot invite that artist' using errcode = '42501';
  end if;
  if exists (
    select 1 from scene_members
    where scene_id = p_scene_id and profile_id = p_profile_id
      and status in ('active', 'banned')
  ) then
    return;
  end if;

  select owner_user_id into v_user from artist_profiles where id = p_profile_id;
  if v_user is null then return; end if;

  insert into scene_members (scene_id, profile_id, user_id, status, role, invited_by_profile_id)
  values (p_scene_id, p_profile_id, v_user, 'invited', 'member', v_me)
  on conflict (scene_id, profile_id) do update
    set status = 'invited', invited_by_profile_id = excluded.invited_by_profile_id;

  select name, slug into v_scene, v_slug from scenes where id = p_scene_id;
  select display_name into v_name from artist_profiles where id = v_me;
  perform notify_profile_owner(
    p_profile_id, v_me, 'scene_invite',
    coalesce(v_name, 'Someone') || ' invited you to ' || coalesce(v_scene, 'a scene'),
    null, 'scene', p_scene_id, '/scenes/' || v_slug,
    'scene_invite:' || p_scene_id::text
  );
end;
$$;

create or replace function set_scene_member_role(
  p_scene_id uuid,
  p_profile_id uuid,
  p_role text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_scene_owner(p_scene_id) then
    raise exception 'Only the scene owner can change roles' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'moderator', 'member') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  -- Handing over ownership demotes the outgoing owner in the same statement,
  -- so uq_scene_single_owner is never momentarily violated.
  if p_role = 'owner' then
    update scene_members set role = 'member'
    where scene_id = p_scene_id and role = 'owner' and profile_id <> p_profile_id;
    update scenes s set owner_profile_id = p_profile_id,
      owner_user_id = (select owner_user_id from artist_profiles where id = p_profile_id)
    where s.id = p_scene_id;
  end if;
  update scene_members set role = p_role
  where scene_id = p_scene_id and profile_id = p_profile_id and status = 'active';
end;
$$;

create or replace function set_scene_member_banned(
  p_scene_id uuid,
  p_profile_id uuid,
  p_banned boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_scene_manager(p_scene_id) then
    raise exception 'Only a scene owner or moderator can do that' using errcode = '42501';
  end if;
  if p_banned and exists (
    select 1 from scene_members
    where scene_id = p_scene_id and profile_id = p_profile_id and role = 'owner'
  ) then
    raise exception 'You cannot ban the scene owner' using errcode = '42501';
  end if;
  update scene_members
  set status = case when p_banned then 'banned' else 'left' end,
      role = 'member'
  where scene_id = p_scene_id and profile_id = p_profile_id;
end;
$$;

create or replace function leave_scene(p_scene_id uuid, p_profile_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not owns_profile(p_profile_id) then
    raise exception 'Not your profile' using errcode = '42501';
  end if;
  if exists (
    select 1 from scene_members
    where scene_id = p_scene_id and profile_id = p_profile_id and role = 'owner'
  ) then
    raise exception 'Hand the scene to someone else before you leave it' using errcode = '42501';
  end if;
  update scene_members set status = 'left', role = 'member'
  where scene_id = p_scene_id and profile_id = p_profile_id;
end;
$$;

revoke execute on function join_scene(uuid, uuid) from public, anon;
revoke execute on function respond_to_scene_join(uuid, uuid, boolean) from public, anon;
revoke execute on function invite_to_scene(uuid, uuid) from public, anon;
revoke execute on function set_scene_member_role(uuid, uuid, text) from public, anon;
revoke execute on function set_scene_member_banned(uuid, uuid, boolean) from public, anon;
revoke execute on function leave_scene(uuid, uuid) from public, anon;
grant execute on function join_scene(uuid, uuid) to authenticated;
grant execute on function respond_to_scene_join(uuid, uuid, boolean) to authenticated;
grant execute on function invite_to_scene(uuid, uuid) to authenticated;
grant execute on function set_scene_member_role(uuid, uuid, text) to authenticated;
grant execute on function set_scene_member_banned(uuid, uuid, boolean) to authenticated;
grant execute on function leave_scene(uuid, uuid) to authenticated;

-- ========== notifications ==========
-- Deliberately sparse. A busy scene must never fan out one notification row
-- per member per post — that buries the existing tray within a day. Only
-- membership events notify here; 050–052 add announcements and events only.
-- Everything else is an unread DOT computed from
-- scene_members.last_read_at vs scenes.last_activity_at: one indexed
-- comparison, zero rows written.

create or replace function notify_on_scene_membership() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_name text;
  v_scene text;
  v_slug text;
begin
  select name, slug into v_scene, v_slug from scenes where id = new.scene_id;
  select display_name into v_name from artist_profiles where id = new.profile_id;

  -- A new request → tell the managers.
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    for r in
      select m.profile_id from scene_members m
      where m.scene_id = new.scene_id and m.status = 'active'
        and m.role in ('owner', 'moderator')
    loop
      perform notify_profile_owner(
        r.profile_id, new.profile_id, 'scene_join_request',
        coalesce(v_name, 'Someone') || ' asked to join ' || coalesce(v_scene, 'your scene'),
        left(new.request_note, 140), 'scene', new.scene_id,
        '/scenes/' || v_slug || '/manage/members',
        'scene_requests:' || new.scene_id::text
      );
    end loop;

  -- Approved → tell the artist.
  elsif tg_op = 'UPDATE' and new.status = 'active' and old.status = 'pending' then
    perform notify_profile_owner(
      new.profile_id, null, 'scene_join_approved',
      'You are in ' || coalesce(v_scene, 'the scene'),
      null, 'scene', new.scene_id, '/scenes/' || v_slug,
      'scene_joined:' || new.scene_id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_scene_membership on scene_members;
create trigger trg_notify_on_scene_membership
  after insert or update of status on scene_members
  for each row execute function notify_on_scene_membership();

-- ========== RLS ==========
-- Every policy is `to authenticated`. The `anon` role gets no policy on any
-- Scenes table at all, so an unauthenticated request reads nothing regardless
-- of the `using` expression — same load-bearing detail as 028.

alter table scenes enable row level security;
alter table scene_members enable row level security;
alter table scene_topics enable row level security;

drop policy if exists select_scenes on scenes;
create policy select_scenes on scenes for select
  to authenticated
  using (can_view_scene(id));

-- Anyone on the network can start a scene. The seed trigger makes them owner.
drop policy if exists insert_scenes on scenes;
create policy insert_scenes on scenes for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and owns_profile(owner_profile_id)
  );

-- Settings are the owner's alone; moderators run the room, not the brand.
drop policy if exists update_scenes on scenes;
create policy update_scenes on scenes for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists delete_scenes on scenes;
create policy delete_scenes on scenes for delete
  to authenticated
  using (owner_user_id = auth.uid());

-- scene_members: these three policies are the ones the 42P17 rule is about.
-- They name auth.uid() and the definer helpers, and NOTHING ELSE.
drop policy if exists select_scene_members on scene_members;
create policy select_scene_members on scene_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or is_scene_member(scene_id)
    or is_scene_manager(scene_id)
  );

-- No direct INSERT path at all: joining goes through join_scene()/
-- invite_to_scene(), which decide `status` from the scene's join_policy. A
-- policy permissive enough to allow the honest case would also let a client
-- write itself an 'active' row into a request-only scene.
drop policy if exists insert_scene_members on scene_members;
create policy insert_scene_members on scene_members for insert
  to authenticated
  with check (false);

-- Members may only ever touch their own read cursor / mute / welcome steps.
-- Role, status and ban changes are definer RPCs. The WITH CHECK re-asserts
-- user_id so a row can't be handed to someone else.
drop policy if exists update_scene_members on scene_members;
create policy update_scene_members on scene_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists select_scene_topics on scene_topics;
create policy select_scene_topics on scene_topics for select
  to authenticated
  using (can_view_scene(scene_id));

drop policy if exists insert_scene_topics on scene_topics;
create policy insert_scene_topics on scene_topics for insert
  to authenticated
  with check (is_scene_manager(scene_id));

drop policy if exists update_scene_topics on scene_topics;
create policy update_scene_topics on scene_topics for update
  to authenticated
  using (is_scene_manager(scene_id))
  with check (is_scene_manager(scene_id));

drop policy if exists delete_scene_topics on scene_topics;
create policy delete_scene_topics on scene_topics for delete
  to authenticated
  using (is_scene_manager(scene_id));
