-- TEMPO migration 029 — people directory + follow graph
-- Additive only. Does not alter any policy on tables that existed at 027.
-- artist_profiles policies from 028 are untouched; only profile_is_readable
-- is create-or-replaced (see comment on that function — not a no-op).
--
-- Standing rules from 028:
--   - every social-table policy is `to authenticated` (no anon policies)
--   - subqueries that must see foreign rows go through security-definer helpers
--   - views over RLS tables carry `with (security_invoker = on)`

-- ========== people (private CRM) ==========

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null,
  linked_profile_id uuid references artist_profiles(id) on delete set null,
  linked_user_id uuid references auth.users(id) on delete set null,
  primary_email text,
  roles text[] not null default '{}',
  tags text[] not null default '{}',
  notes text,
  avatar_url text,
  source text not null default 'manual'
    check (source in ('manual','collaborator','guest_review','release_credit','import')),
  is_archived boolean not null default false,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_people_user on people (user_id) where not is_archived;
create index if not exists idx_people_linked_profile
  on people (user_id, linked_profile_id) where linked_profile_id is not null;
create index if not exists idx_people_email
  on people (user_id, lower(primary_email)) where primary_email is not null;

drop trigger if exists trg_people_updated_at on people;
create or replace function touch_people_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_people_updated_at before update on people
  for each row execute function touch_people_updated_at();

-- Every email / handle / credit string ever seen for a person.
create table if not exists person_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  kind text not null check (kind in ('email','name','handle','credit')),
  value text not null,
  value_norm text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, value_norm)
);

create index if not exists idx_person_identities_person on person_identities (person_id);

-- Provenance: which track/project, what role, when.
create table if not exists person_appearances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  source text not null
    check (source in ('collaborator','guest_review','release_credit','import','manual')),
  role text,
  track_id uuid references tracks(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  guest_link_id uuid references guest_review_links(id) on delete set null,
  label text,
  appeared_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_person_appearances_person
  on person_appearances (person_id, appeared_at desc);
create index if not exists idx_person_appearances_track
  on person_appearances (track_id) where track_id is not null;

-- Link future rows back to the CRM without rewriting free-text sources.
alter table track_collaborators
  add column if not exists person_id uuid references people(id) on delete set null;
alter table comments
  add column if not exists person_id uuid references people(id) on delete set null;
alter table guest_review_links
  add column if not exists person_id uuid references people(id) on delete set null;

-- ========== upsert_person (find-or-create) ==========

create or replace function normalize_person_value(p_kind text, p_value text)
returns text
language sql immutable as $$
  select case
    when p_kind = 'email' then lower(trim(p_value))
    else lower(regexp_replace(trim(p_value), '\s+', ' ', 'g'))
  end;
$$;

-- Security definer: seeders/triggers run as the track owner, and may need to
-- insert into people for that owner even when the triggering statement is
-- from a guest path (service role). Callers pass an explicit owner user_id.
create or replace function upsert_person(
  p_user_id uuid,
  p_display_name text,
  p_kind text,
  p_value text,
  p_source text default 'manual',
  p_role text default null,
  p_email text default null,
  p_linked_user_id uuid default null,
  p_linked_profile_id uuid default null,
  p_track_id uuid default null,
  p_project_id uuid default null,
  p_guest_link_id uuid default null,
  p_appearance_label text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_norm text;
  v_person_id uuid;
  v_name text;
begin
  if p_user_id is null or p_value is null or trim(p_value) = '' then
    return null;
  end if;
  v_norm := normalize_person_value(p_kind, p_value);
  if v_norm is null or v_norm = '' then
    return null;
  end if;
  v_name := coalesce(nullif(trim(p_display_name), ''), trim(p_value));

  -- Prefer an existing identity match for this owner.
  select pi.person_id into v_person_id
  from person_identities pi
  where pi.user_id = p_user_id
    and pi.kind = p_kind
    and pi.value_norm = v_norm
  limit 1;

  -- Fall back: same email already on a people row.
  if v_person_id is null and p_kind = 'email' then
    select p.id into v_person_id
    from people p
    where p.user_id = p_user_id
      and p.primary_email is not null
      and lower(p.primary_email) = v_norm
    limit 1;
  end if;

  -- Fall back: same display name for credit/name kinds (loose but intentional
  -- for release-credit strings that reappear across tracks).
  if v_person_id is null and p_kind in ('name', 'credit') then
    select p.id into v_person_id
    from people p
    where p.user_id = p_user_id
      and lower(p.display_name) = v_norm
    limit 1;
  end if;

  if v_person_id is null then
    insert into people (
      user_id, display_name, primary_email, source, linked_user_id,
      linked_profile_id, roles, last_interaction_at
    ) values (
      p_user_id,
      v_name,
      case when p_kind = 'email' then v_norm else nullif(lower(trim(coalesce(p_email, ''))), '') end,
      p_source,
      p_linked_user_id,
      p_linked_profile_id,
      case when p_role is not null then array[p_role]::text[] else '{}'::text[] end,
      now()
    )
    returning id into v_person_id;
  else
    update people set
      display_name = case
        when display_name ~ '^[^\s@]+@[^\s@]+$' and v_name !~ '@' then v_name
        else display_name
      end,
      primary_email = coalesce(
        primary_email,
        case when p_kind = 'email' then v_norm
             else nullif(lower(trim(coalesce(p_email, ''))), '') end
      ),
      linked_user_id = coalesce(linked_user_id, p_linked_user_id),
      linked_profile_id = coalesce(linked_profile_id, p_linked_profile_id),
      roles = case
        when p_role is null then roles
        when roles @> array[p_role]::text[] then roles
        else roles || p_role
      end,
      last_interaction_at = now(),
      is_archived = false
    where id = v_person_id;
  end if;

  insert into person_identities (user_id, person_id, kind, value, value_norm)
  values (p_user_id, v_person_id, p_kind, trim(p_value), v_norm)
  on conflict (user_id, kind, value_norm) do nothing;

  -- Also store a name identity when we have a human display name.
  if p_kind = 'email' and v_name is not null and v_name !~ '@' then
    insert into person_identities (user_id, person_id, kind, value, value_norm)
    values (
      p_user_id, v_person_id, 'name', v_name,
      normalize_person_value('name', v_name)
    )
    on conflict (user_id, kind, value_norm) do nothing;
  end if;

  -- Appearance row (deduped loosely by person + source + track/project + role).
  if p_track_id is not null or p_project_id is not null or p_guest_link_id is not null
     or p_appearance_label is not null then
    if not exists (
      select 1 from person_appearances a
      where a.user_id = p_user_id
        and a.person_id = v_person_id
        and a.source = p_source
        and a.role is not distinct from p_role
        and a.track_id is not distinct from p_track_id
        and a.project_id is not distinct from p_project_id
        and a.guest_link_id is not distinct from p_guest_link_id
    ) then
      insert into person_appearances (
        user_id, person_id, source, role, track_id, project_id,
        guest_link_id, label
      ) values (
        p_user_id, v_person_id, p_source, p_role, p_track_id, p_project_id,
        p_guest_link_id, p_appearance_label
      );
    end if;
  end if;

  return v_person_id;
end;
$$;

revoke execute on function upsert_person(
  uuid, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, text
) from public, anon;
grant execute on function upsert_person(
  uuid, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, text
) to authenticated;

-- ========== seed triggers ==========

create or replace function seed_person_from_collaborator() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_person uuid;
begin
  if new.invited_email is null or trim(new.invited_email) = '' then
    return new;
  end if;
  select t.user_id into v_owner from tracks t where t.id = new.track_id;
  if v_owner is null then return new; end if;

  v_person := upsert_person(
    v_owner,
    split_part(new.invited_email, '@', 1),
    'email',
    new.invited_email,
    'collaborator',
    new.role,
    new.invited_email,
    new.user_id,
    null,
    new.track_id,
    null,
    null,
    'Collaborator (' || new.role || ')'
  );
  new.person_id := v_person;
  return new;
end;
$$;

drop trigger if exists trg_seed_person_from_collaborator on track_collaborators;
create trigger trg_seed_person_from_collaborator
  before insert on track_collaborators
  for each row execute function seed_person_from_collaborator();

create or replace function seed_person_from_guest_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_person uuid;
begin
  if new.guest_link_id is null then return new; end if;
  if new.guest_name is null or trim(new.guest_name) = '' then return new; end if;

  select t.user_id into v_owner from tracks t where t.id = new.track_id;
  if v_owner is null then return new; end if;

  v_person := upsert_person(
    v_owner,
    new.guest_name,
    'name',
    new.guest_name,
    'guest_review',
    'guest_reviewer',
    null,
    null,
    null,
    new.track_id,
    null,
    new.guest_link_id,
    'Guest review'
  );
  new.person_id := v_person;
  return new;
end;
$$;

drop trigger if exists trg_seed_person_from_guest_comment on comments;
create trigger trg_seed_person_from_guest_comment
  before insert on comments
  for each row execute function seed_person_from_guest_comment();

create or replace function seed_person_from_release_credits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_credit text;
begin
  select p.user_id into v_owner from projects p where p.id = new.project_id;
  if v_owner is null then return new; end if;

  if new.primary_artist is not null and trim(new.primary_artist) <> '' then
    perform upsert_person(
      v_owner, new.primary_artist, 'credit', new.primary_artist,
      'release_credit', 'primary_artist', null, null, null,
      new.track_id, new.project_id, null, 'Primary artist'
    );
  end if;
  if new.mix_engineer is not null and trim(new.mix_engineer) <> '' then
    perform upsert_person(
      v_owner, new.mix_engineer, 'credit', new.mix_engineer,
      'release_credit', 'mix_engineer', null, null, null,
      new.track_id, new.project_id, null, 'Mix engineer'
    );
  end if;
  if new.mastering_engineer is not null and trim(new.mastering_engineer) <> '' then
    perform upsert_person(
      v_owner, new.mastering_engineer, 'credit', new.mastering_engineer,
      'release_credit', 'mastering_engineer', null, null, null,
      new.track_id, new.project_id, null, 'Mastering engineer'
    );
  end if;

  foreach v_credit in array coalesce(new.featured_artists, '{}') loop
    if v_credit is not null and trim(v_credit) <> '' then
      perform upsert_person(
        v_owner, v_credit, 'credit', v_credit,
        'release_credit', 'featured_artist', null, null, null,
        new.track_id, new.project_id, null, 'Featured artist'
      );
    end if;
  end loop;
  foreach v_credit in array coalesce(new.writers, '{}') loop
    if v_credit is not null and trim(v_credit) <> '' then
      perform upsert_person(
        v_owner, v_credit, 'credit', v_credit,
        'release_credit', 'writer', null, null, null,
        new.track_id, new.project_id, null, 'Writer'
      );
    end if;
  end loop;
  foreach v_credit in array coalesce(new.producers, '{}') loop
    if v_credit is not null and trim(v_credit) <> '' then
      perform upsert_person(
        v_owner, v_credit, 'credit', v_credit,
        'release_credit', 'producer', null, null, null,
        new.track_id, new.project_id, null, 'Producer'
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_seed_person_from_release_credits on release_track_metadata;
create trigger trg_seed_person_from_release_credits
  after insert or update on release_track_metadata
  for each row execute function seed_person_from_release_credits();

-- ========== one-time backfill ==========
-- Idempotent: upsert_person dedupes by identity + appearance keys.
-- Wrapped in a DO block so a partial failure rolls back cleanly.

do $$
declare
  r record;
  v_credit text;
begin
  -- Collaborator emails
  for r in
    select c.*, t.user_id as owner_id
    from track_collaborators c
    join tracks t on t.id = c.track_id
    where c.invited_email is not null and trim(c.invited_email) <> ''
  loop
    update track_collaborators
    set person_id = upsert_person(
      r.owner_id,
      split_part(r.invited_email, '@', 1),
      'email',
      r.invited_email,
      'collaborator',
      r.role,
      r.invited_email,
      r.user_id,
      null,
      r.track_id,
      null,
      null,
      'Collaborator (' || r.role || ')'
    )
    where id = r.id and person_id is null;
  end loop;

  -- Guest comment names
  for r in
    select c.*, t.user_id as owner_id
    from comments c
    join tracks t on t.id = c.track_id
    where c.guest_link_id is not null
      and c.guest_name is not null
      and trim(c.guest_name) <> ''
  loop
    update comments
    set person_id = upsert_person(
      r.owner_id,
      r.guest_name,
      'name',
      r.guest_name,
      'guest_review',
      'guest_reviewer',
      null, null, null,
      r.track_id, null, r.guest_link_id,
      'Guest review'
    )
    where id = r.id and person_id is null;
  end loop;

  -- Release credits (arrays + scalars) — free-text columns stay the source of truth.
  for r in
    select m.*, p.user_id as owner_id
    from release_track_metadata m
    join projects p on p.id = m.project_id
  loop
    if r.primary_artist is not null and trim(r.primary_artist) <> '' then
      perform upsert_person(
        r.owner_id, r.primary_artist, 'credit', r.primary_artist,
        'release_credit', 'primary_artist', null, null, null,
        r.track_id, r.project_id, null, 'Primary artist'
      );
    end if;
    if r.mix_engineer is not null and trim(r.mix_engineer) <> '' then
      perform upsert_person(
        r.owner_id, r.mix_engineer, 'credit', r.mix_engineer,
        'release_credit', 'mix_engineer', null, null, null,
        r.track_id, r.project_id, null, 'Mix engineer'
      );
    end if;
    if r.mastering_engineer is not null and trim(r.mastering_engineer) <> '' then
      perform upsert_person(
        r.owner_id, r.mastering_engineer, 'credit', r.mastering_engineer,
        'release_credit', 'mastering_engineer', null, null, null,
        r.track_id, r.project_id, null, 'Mastering engineer'
      );
    end if;
    foreach v_credit in array coalesce(r.featured_artists, '{}') loop
      if v_credit is not null and trim(v_credit) <> '' then
        perform upsert_person(
          r.owner_id, v_credit, 'credit', v_credit,
          'release_credit', 'featured_artist', null, null, null,
          r.track_id, r.project_id, null, 'Featured artist'
        );
      end if;
    end loop;
    foreach v_credit in array coalesce(r.writers, '{}') loop
      if v_credit is not null and trim(v_credit) <> '' then
        perform upsert_person(
          r.owner_id, v_credit, 'credit', v_credit,
          'release_credit', 'writer', null, null, null,
          r.track_id, r.project_id, null, 'Writer'
        );
      end if;
    end loop;
    foreach v_credit in array coalesce(r.producers, '{}') loop
      if v_credit is not null and trim(v_credit) <> '' then
        perform upsert_person(
          r.owner_id, v_credit, 'credit', v_credit,
          'release_credit', 'producer', null, null, null,
          r.track_id, r.project_id, null, 'Producer'
        );
      end if;
    end loop;
  end loop;
end $$;

-- ========== people RLS ==========

alter table people enable row level security;
alter table person_identities enable row level security;
alter table person_appearances enable row level security;

drop policy if exists own_people on people;
create policy own_people on people for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_person_identities on person_identities;
create policy own_person_identities on person_identities for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_person_appearances on person_appearances;
create policy own_person_appearances on person_appearances for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ========== follow graph ==========

create table if not exists profile_follows (
  follower_profile_id uuid not null references artist_profiles(id) on delete cascade,
  followee_profile_id uuid not null references artist_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_profile_id, followee_profile_id),
  constraint profile_follows_no_self check (follower_profile_id <> followee_profile_id)
);

create index if not exists idx_profile_follows_followee
  on profile_follows (followee_profile_id, created_at desc);
create index if not exists idx_profile_follows_follower
  on profile_follows (follower_profile_id, created_at desc);

create table if not exists profile_blocks (
  blocker_profile_id uuid not null references artist_profiles(id) on delete cascade,
  blocked_profile_id uuid not null references artist_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_profile_id, blocked_profile_id),
  constraint profile_blocks_no_self check (blocker_profile_id <> blocked_profile_id)
);

create index if not exists idx_profile_blocks_blocked
  on profile_blocks (blocked_profile_id);

-- Mutual follows only — derived, never stored.
-- security_invoker so profile_follows RLS still applies to callers.
create or replace view profile_connections
  with (security_invoker = on)
as
  select
    a.follower_profile_id as profile_a_id,
    a.followee_profile_id as profile_b_id,
    greatest(a.created_at, b.created_at) as connected_at
  from profile_follows a
  join profile_follows b
    on b.follower_profile_id = a.followee_profile_id
   and b.followee_profile_id = a.follower_profile_id
  where a.follower_profile_id < a.followee_profile_id;

-- Block check MUST go through a definer helper — an inline subquery over
-- profile_blocks inside a follow INSERT policy would be RLS-filtered to the
-- caller's own block rows and silently allow follows the other direction.
create or replace function is_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile_blocks b
    where (b.blocker_profile_id = p_a and b.blocked_profile_id = p_b)
       or (b.blocker_profile_id = p_b and b.blocked_profile_id = p_a)
  );
$$;

revoke execute on function is_blocked_between(uuid, uuid) from public, anon;
grant execute on function is_blocked_between(uuid, uuid) to authenticated;

create or replace function is_following(p_follower uuid, p_followee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile_follows f
    where f.follower_profile_id = p_follower
      and f.followee_profile_id = p_followee
  );
$$;

revoke execute on function is_following(uuid, uuid) from public, anon;
grant execute on function is_following(uuid, uuid) to authenticated;

-- NOT a no-op: this replaces the migration-028 definition. Other tables'
-- policies already call profile_is_readable; adding the block exclusion
-- changes what those policies return for blocked pairs.
create or replace function profile_is_readable(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artist_profiles p
    where p.id = p_profile_id
      and (
        p.owner_user_id = auth.uid()
        or (
          p.visibility in ('members', 'public')
          and auth.uid() is not null
          and not exists (
            select 1 from profile_blocks b
            where (b.blocker_profile_id = p.id and b.blocked_profile_id in (select my_profile_ids()))
               or (b.blocked_profile_id = p.id and b.blocker_profile_id in (select my_profile_ids()))
          )
        )
      )
  );
$$;

revoke execute on function profile_is_readable(uuid) from public, anon;
grant execute on function profile_is_readable(uuid) to authenticated;

-- Notify on follow
create or replace function notify_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
  v_handle text;
begin
  select display_name, handle into v_actor_name, v_handle
  from artist_profiles where id = new.follower_profile_id;
  perform notify_profile_owner(
    new.followee_profile_id,
    new.follower_profile_id,
    'profile_follow',
    coalesce(v_actor_name, 'Someone') || ' followed you',
    null,
    'profile',
    new.follower_profile_id,
    case when v_handle is not null then '/artist/' || v_handle else null end,
    'follow:' || new.follower_profile_id::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_follow on profile_follows;
create trigger trg_notify_on_follow after insert on profile_follows
  for each row execute function notify_on_follow();

-- When a block is created, drop both directions of the follow.
create or replace function clear_follows_on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from profile_follows
  where (follower_profile_id = new.blocker_profile_id and followee_profile_id = new.blocked_profile_id)
     or (follower_profile_id = new.blocked_profile_id and followee_profile_id = new.blocker_profile_id);
  return new;
end;
$$;

drop trigger if exists trg_clear_follows_on_block on profile_blocks;
create trigger trg_clear_follows_on_block after insert on profile_blocks
  for each row execute function clear_follows_on_block();

alter table profile_follows enable row level security;
alter table profile_blocks enable row level security;

drop policy if exists read_profile_follows on profile_follows;
create policy read_profile_follows on profile_follows for select
  to authenticated
  using (
    owns_profile(follower_profile_id)
    or owns_profile(followee_profile_id)
    or (
      profile_is_readable(follower_profile_id)
      and profile_is_readable(followee_profile_id)
      and not is_blocked_between(follower_profile_id, followee_profile_id)
    )
  );

drop policy if exists insert_profile_follows on profile_follows;
create policy insert_profile_follows on profile_follows for insert
  to authenticated
  with check (
    owns_profile(follower_profile_id)
    and profile_is_readable(followee_profile_id)
    and not is_blocked_between(follower_profile_id, followee_profile_id)
  );

drop policy if exists delete_profile_follows on profile_follows;
create policy delete_profile_follows on profile_follows for delete
  to authenticated
  using (owns_profile(follower_profile_id));

drop policy if exists read_profile_blocks on profile_blocks;
create policy read_profile_blocks on profile_blocks for select
  to authenticated
  using (owns_profile(blocker_profile_id));

drop policy if exists insert_profile_blocks on profile_blocks;
create policy insert_profile_blocks on profile_blocks for insert
  to authenticated
  with check (
    owns_profile(blocker_profile_id)
    and blocker_profile_id <> blocked_profile_id
  );

drop policy if exists delete_profile_blocks on profile_blocks;
create policy delete_profile_blocks on profile_blocks for delete
  to authenticated
  using (owns_profile(blocker_profile_id));
