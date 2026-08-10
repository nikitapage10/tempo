-- TEMPO migration 060: account-level Scene personas
-- Depends on 049-059. Additive/backfilling; preserves every existing Scene.

create table if not exists account_surface_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_surface text not null default 'last'
    check (home_surface in ('tempo', 'scenes', 'last')),
  last_scene_id uuid references scenes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scene_personas (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_profile_id uuid references artist_profiles(id) on delete set null,
  display_name text not null,
  handle text,
  avatar_url text,
  bio text,
  pronouns text,
  location text,
  country_code text,
  links jsonb not null default '[]'::jsonb,
  source text not null default 'account'
    check (source in ('account', 'artist', 'invitation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scene_id, user_id),
  constraint scene_persona_name_len check (char_length(trim(display_name)) between 1 and 80),
  constraint scene_persona_handle_shape check (
    handle is null or (
      handle = lower(handle) and handle ~ '^[a-z0-9_]{2,30}$'
    )
  ),
  constraint scene_persona_bio_len check (bio is null or char_length(bio) <= 1000),
  constraint scene_persona_pronouns_len check (pronouns is null or char_length(pronouns) <= 80),
  constraint scene_persona_links_len check (jsonb_array_length(links) <= 12)
);

create unique index if not exists uq_scene_persona_handle
  on scene_personas (scene_id, lower(handle)) where handle is not null;
create index if not exists idx_scene_personas_user on scene_personas (user_id, scene_id);

-- Backfill one persona for every account/Scene pair. When a legacy account
-- joined with more than one artist profile, the strongest role is selected
-- for presentation; membership consolidation below preserves the strongest
-- authorization state.
insert into scene_personas (
  scene_id, user_id, artist_profile_id, display_name, handle, avatar_url,
  bio, location, country_code, links, source
)
select distinct on (m.scene_id, m.user_id)
  m.scene_id,
  m.user_id,
  m.profile_id,
  coalesce(nullif(trim(ap.display_name), ''), nullif(trim(a.name), ''), 'Member'),
  ap.handle,
  ap.emblem_url,
  ap.bio,
  ap.location,
  ap.country_code,
  ap.links,
  'artist'
from scene_members m
left join artist_profiles ap on ap.id = m.profile_id
left join artists a on a.id = ap.artist_id
order by m.scene_id, m.user_id,
  case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end,
  case m.status when 'banned' then 0 when 'active' then 1 when 'pending' then 2
    when 'invited' then 3 else 4 end,
  m.created_at
on conflict (scene_id, user_id) do nothing;

alter table scene_members add column if not exists id uuid default gen_random_uuid();
alter table scene_members add column if not exists persona_id uuid references scene_personas(id) on delete cascade;

-- A previous attempt can fail after conversation_participants has moved from
-- its legacy (conversation_id, profile_id) primary key to the account-level
-- id/user constraints below. On retry, the migration-053 membership trigger
-- would otherwise fire during this backfill while still targeting that removed
-- profile conflict key. Install a constraint-agnostic bridge first so both a
-- fresh schema and a partially applied 060 can safely reach the final trigger.
alter table conversation_participants add column if not exists scene_persona_id uuid references scene_personas(id) on delete cascade;

create or replace function sync_scene_chat_participant() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_conv uuid; v_role text;
begin
  select id into v_conv from conversations
  where scene_id = new.scene_id and scene_topic_id is null;
  if v_conv is null then return new; end if;
  v_role := case when new.role in ('owner', 'moderator') then 'admin' else 'member' end;

  if new.status = 'active' then
    update conversation_participants set
      left_at = null,
      role = v_role,
      scene_persona_id = new.persona_id
    where conversation_id = v_conv and user_id = new.user_id;

    if not found then
      insert into conversation_participants (
        conversation_id, profile_id, scene_persona_id, user_id, role
      ) values (v_conv, new.profile_id, new.persona_id, new.user_id, v_role);
    end if;
  else
    update conversation_participants set left_at = coalesce(left_at, now())
    where conversation_id = v_conv and user_id = new.user_id;
  end if;
  return new;
end;
$$;

update scene_members m
set persona_id = p.id
from scene_personas p
where p.scene_id = m.scene_id and p.user_id = m.user_id and m.persona_id is null;

-- Consolidate the rare legacy case where one account used several artist
-- profiles in the same Scene. A ban wins; otherwise strongest role/state wins.
with ranked as (
  select ctid, scene_id, user_id,
    row_number() over (
      partition by scene_id, user_id
      order by case status when 'banned' then 0 when 'active' then 1 when 'pending' then 2
        when 'invited' then 3 else 4 end,
        case role when 'owner' then 0 when 'moderator' then 1 else 2 end,
        created_at
    ) as rn
  from scene_members
), merged as (
  select scene_id, user_id,
    case when bool_or(status = 'banned') then 'banned'
      when bool_or(status = 'active') then 'active'
      when bool_or(status = 'pending') then 'pending'
      when bool_or(status = 'invited') then 'invited' else 'left' end as status,
    case when bool_or(role = 'owner') then 'owner'
      when bool_or(role = 'moderator') then 'moderator' else 'member' end as role,
    min(joined_at) as joined_at,
    max(last_read_at) as last_read_at,
    max(points) as points,
    max(streak_days) as streak_days,
    max(last_active_on) as last_active_on
  from scene_members group by scene_id, user_id
)
update scene_members m set
  status = x.status,
  role = case when x.status = 'active' then x.role else 'member' end,
  joined_at = x.joined_at,
  last_read_at = x.last_read_at,
  points = x.points,
  streak_days = x.streak_days,
  last_active_on = x.last_active_on
from ranked r join merged x using (scene_id, user_id)
where m.ctid = r.ctid and r.rn = 1;

with ranked as (
  select ctid, row_number() over (
    partition by scene_id, user_id
    order by case status when 'banned' then 0 when 'active' then 1 else 2 end,
      case role when 'owner' then 0 when 'moderator' then 1 else 2 end, created_at
  ) as rn from scene_members
)
delete from scene_members m using ranked r where m.ctid = r.ctid and r.rn > 1;

alter table scene_members alter column persona_id set not null;
alter table scene_members drop constraint if exists scene_members_pkey;
alter table scene_members alter column profile_id drop not null;
alter table scene_members add primary key (id);
create unique index if not exists uq_scene_members_account on scene_members (scene_id, user_id);
create unique index if not exists uq_scene_members_persona on scene_members (scene_id, persona_id);

alter table scenes alter column owner_profile_id drop not null;

-- Scene authorship becomes persona-first while legacy artist columns remain
-- available to the existing social renderers during the compatibility window.
alter table posts add column if not exists author_scene_persona_id uuid references scene_personas(id) on delete set null;
alter table post_comments add column if not exists author_scene_persona_id uuid references scene_personas(id) on delete set null;
alter table post_likes add column if not exists scene_persona_id uuid references scene_personas(id) on delete cascade;
alter table messages add column if not exists sender_scene_persona_id uuid references scene_personas(id) on delete set null;
alter table conversations add column if not exists created_by_scene_persona_id uuid references scene_personas(id) on delete set null;
alter table conversation_participants add column if not exists scene_persona_id uuid references scene_personas(id) on delete cascade;
alter table scene_events add column if not exists created_by_persona_id uuid references scene_personas(id) on delete set null;
alter table scene_event_rsvps add column if not exists persona_id uuid references scene_personas(id) on delete cascade;

alter table conversations alter column created_by_profile_id drop not null;
alter table messages alter column sender_profile_id drop not null;
alter table posts alter column author_profile_id drop not null;
alter table post_comments alter column author_profile_id drop not null;
alter table scene_events alter column created_by_profile_id drop not null;

alter table conversation_participants add column if not exists id uuid default gen_random_uuid();
alter table conversation_participants drop constraint if exists conversation_participants_pkey;
alter table conversation_participants alter column profile_id drop not null;
alter table conversation_participants add primary key (id);

-- The same legacy account could enter one Scene through several artist
-- profiles. scene_members was consolidated above; mirror that consolidation
-- in its room before enforcing one participant row per account.
with ranked as (
  select id, row_number() over (
    partition by conversation_id, user_id
    order by (left_at is null) desc, (role = 'admin') desc, joined_at, id
  ) as rn
  from conversation_participants
)
delete from conversation_participants cp
using ranked r
where cp.id = r.id and r.rn > 1;

create unique index if not exists uq_conversation_participant_user
  on conversation_participants (conversation_id, user_id);

alter table post_likes add column if not exists id uuid default gen_random_uuid();
alter table post_likes drop constraint if exists post_likes_pkey;
alter table post_likes alter column profile_id drop not null;
alter table post_likes add primary key (id);
create unique index if not exists uq_post_like_user on post_likes (post_id, user_id);

alter table scene_event_rsvps add column if not exists id uuid default gen_random_uuid();
alter table scene_event_rsvps drop constraint if exists scene_event_rsvps_pkey;
alter table scene_event_rsvps alter column profile_id drop not null;
alter table scene_event_rsvps add primary key (id);
create unique index if not exists uq_scene_event_rsvp_user on scene_event_rsvps (event_id, user_id);

update posts x set author_scene_persona_id = p.id
from scene_personas p where x.scene_id = p.scene_id and x.author_user_id = p.user_id
  and x.author_scene_persona_id is null;
update post_comments x set author_scene_persona_id = p.id
from posts po join scene_personas p on p.scene_id = po.scene_id
where x.post_id = po.id and x.author_user_id = p.user_id
  and x.author_scene_persona_id is null;
update messages x set sender_scene_persona_id = p.id
from conversations c join scene_personas p on p.scene_id = c.scene_id
where x.conversation_id = c.id and x.sender_user_id = p.user_id
  and x.sender_scene_persona_id is null;

update conversation_participants x set scene_persona_id = p.id
from conversations c join scene_personas p on p.scene_id = c.scene_id
where x.conversation_id = c.id and x.user_id = p.user_id and x.scene_persona_id is null;
update scene_events x set created_by_persona_id = p.id
from scene_personas p where x.scene_id = p.scene_id and x.created_by_user_id = p.user_id
  and x.created_by_persona_id is null;
update scene_event_rsvps x set persona_id = p.id
from scene_events e join scene_personas p on p.scene_id = e.scene_id
where x.event_id = e.id and x.user_id = p.user_id and x.persona_id is null;

-- Replace v1 seed/mirror functions so a Scene whose owner has no artist can
-- still seed atomically. Existing artist-linked inserts continue to work.
create or replace function seed_new_scene() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_persona uuid; v_name text; v_handle text; v_avatar text;
begin
  if new.owner_profile_id is not null then
    select display_name, handle, emblem_url into v_name, v_handle, v_avatar
    from artist_profiles where id = new.owner_profile_id;
  end if;
  if v_name is null then
    select coalesce(nullif(raw_user_meta_data->>'full_name', ''), split_part(email, '@', 1), 'Owner')
    into v_name from auth.users where id = new.owner_user_id;
  end if;
  insert into scene_personas (
    scene_id, user_id, artist_profile_id, display_name, handle, avatar_url, source
  ) values (
    new.id, new.owner_user_id, new.owner_profile_id, coalesce(v_name, 'Owner'),
    v_handle, v_avatar, case when new.owner_profile_id is null then 'account' else 'artist' end
  ) on conflict (scene_id, user_id) do update set updated_at = now()
  returning id into v_persona;

  insert into scene_members (scene_id, persona_id, profile_id, user_id, role, status, joined_at)
  values (new.id, v_persona, new.owner_profile_id, new.owner_user_id, 'owner', 'active', now())
  on conflict (scene_id, user_id) do nothing;

  insert into scene_topics (scene_id, name, slug, sort_order, kind)
  values (new.id, 'General', 'general', 0, 'feed') on conflict do nothing;
  return new;
end;
$$;

create or replace function ensure_scene_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_persona uuid;
begin
  select id into v_id from conversations
  where scene_id = new.id and scene_topic_id is null;
  if v_id is not null then return new; end if;
  select id into v_persona from scene_personas
  where scene_id = new.id and user_id = new.owner_user_id;
  insert into conversations (
    kind, title, created_by_profile_id, created_by_scene_persona_id, scene_id
  ) values ('group', new.name, new.owner_profile_id, v_persona, new.id)
  on conflict do nothing returning id into v_id;
  return new;
end;
$$;

create or replace function sync_scene_chat_participant() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_conv uuid; v_role text;
begin
  select id into v_conv from conversations
  where scene_id = new.scene_id and scene_topic_id is null;
  if v_conv is null then return new; end if;
  v_role := case when new.role in ('owner', 'moderator') then 'admin' else 'member' end;
  if new.status = 'active' then
    insert into conversation_participants (
      conversation_id, profile_id, scene_persona_id, user_id, role
    ) values (v_conv, new.profile_id, new.persona_id, new.user_id, v_role)
    on conflict (conversation_id, user_id) do update
      set left_at = null, role = excluded.role,
          profile_id = excluded.profile_id, scene_persona_id = excluded.scene_persona_id;
  else
    update conversation_participants set left_at = coalesce(left_at, now())
    where conversation_id = v_conv and user_id = new.user_id;
  end if;
  return new;
end;
$$;

create or replace function scene_persona_id(p_scene_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from scene_personas p
  where p.scene_id = p_scene_id and p.user_id = auth.uid()
  limit 1;
$$;

create or replace function ensure_scene_persona(
  p_scene_id uuid,
  p_display_name text,
  p_artist_profile_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_artist_profile_id is not null and not owns_profile(p_artist_profile_id) then
    raise exception 'Not your artist profile' using errcode = '42501';
  end if;
  if not exists (select 1 from scenes where id = p_scene_id and archived_at is null) then
    raise exception 'Scene unavailable' using errcode = 'P0002';
  end if;
  insert into scene_personas (scene_id, user_id, artist_profile_id, display_name, source)
  values (p_scene_id, auth.uid(), p_artist_profile_id, trim(p_display_name),
    case when p_artist_profile_id is null then 'account' else 'artist' end)
  on conflict (scene_id, user_id) do update set
    artist_profile_id = coalesce(excluded.artist_profile_id, scene_personas.artist_profile_id),
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function join_scene_v2(p_scene_id uuid, p_persona_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_policy text; v_next text; v_user uuid;
begin
  select user_id into v_user from scene_personas
  where id = p_persona_id and scene_id = p_scene_id;
  if v_user is distinct from auth.uid() then raise exception 'Not your persona' using errcode = '42501'; end if;
  if not can_view_scene(p_scene_id) then raise exception 'Scene unavailable' using errcode = '42501'; end if;
  select join_policy into v_policy from scenes where id = p_scene_id and archived_at is null;
  if v_policy is null then raise exception 'Scene unavailable' using errcode = 'P0002'; end if;
  if v_policy = 'invite' and not exists (
    select 1 from scene_members where scene_id = p_scene_id and user_id = auth.uid() and status = 'invited'
  ) then raise exception 'Invite only' using errcode = '42501'; end if;
  v_next := case when v_policy = 'request' then 'pending' else 'active' end;
  insert into scene_members (scene_id, persona_id, profile_id, user_id, role, status, joined_at)
  select p_scene_id, p_persona_id, artist_profile_id, auth.uid(), 'member', v_next,
    case when v_next = 'active' then now() else null end
  from scene_personas where id = p_persona_id
  on conflict (scene_id, user_id) do update set
    persona_id = excluded.persona_id,
    profile_id = excluded.profile_id,
    status = case when scene_members.status = 'banned' then 'banned' else excluded.status end,
    joined_at = case when scene_members.status = 'banned' then scene_members.joined_at
      else coalesce(scene_members.joined_at, excluded.joined_at) end,
    updated_at = now()
  returning status into v_next;
  return v_next;
end;
$$;

alter table account_surface_preferences enable row level security;
alter table scene_personas enable row level security;

drop policy if exists own_account_surface_preferences on account_surface_preferences;
create policy own_account_surface_preferences on account_surface_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists select_scene_personas on scene_personas;
create policy select_scene_personas on scene_personas for select to authenticated
  using (user_id = auth.uid() or is_scene_member(scene_id) or is_scene_manager(scene_id));
drop policy if exists insert_scene_personas on scene_personas;
create policy insert_scene_personas on scene_personas for insert to authenticated
  with check (user_id = auth.uid() and can_view_scene(scene_id));
drop policy if exists update_scene_personas on scene_personas;
create policy update_scene_personas on scene_personas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists insert_scenes on scenes;
create policy insert_scenes on scenes for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (owner_profile_id is null or owns_profile(owner_profile_id))
  );

revoke execute on function scene_persona_id(uuid) from public, anon;
revoke execute on function ensure_scene_persona(uuid, text, uuid) from public, anon;
revoke execute on function join_scene_v2(uuid, uuid) from public, anon;
grant execute on function scene_persona_id(uuid) to authenticated;
grant execute on function ensure_scene_persona(uuid, text, uuid) to authenticated;
grant execute on function join_scene_v2(uuid, uuid) to authenticated;
