-- TEMPO migration 114 — Sessions, part 1: the persistent room
-- Additive only. Run in the Supabase SQL editor after migration 113.
--
-- A Session grants access to THE ROOM, never to anyone's catalog. No policy
-- or helper in this file may hand a Session member a track file_url, a signed
-- audio URL, or an artist id they did not already have through an area grant.
-- Pin summaries return titles and artwork paths only.
--
-- NO POLICY ON `session_members` MAY NAME `session_members` IN A SUBQUERY.
-- A membership table whose own policy asks "is the caller a member?" by
-- querying itself raises 42P17 infinite recursion. Every such question goes
-- through is_session_member()/is_session_host() below, which are
-- `security definer` and therefore not RLS-evaluated.
--
-- The existing `sessions` table is the per-track focus log. These rooms live
-- in `session_rooms`. Do not rename or drop `sessions`.

-- ---------- session_rooms ----------

create table if not exists session_rooms (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  purpose text not null default '' check (char_length(purpose) <= 500),
  status text not null default 'active' check (status in ('active', 'archived')),
  notes text not null default '',
  notes_updated_at timestamptz,
  notes_updated_by_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  last_hang_at timestamptz,
  hang_count integer not null default 0 check (hang_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_session_rooms_artist_status_hang
  on session_rooms (artist_id, status, last_hang_at desc nulls last);

-- ---------- session_members ----------

create table if not exists session_members (
  id uuid primary key default gen_random_uuid(),
  session_room_id uuid not null references session_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references artist_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'member')),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (session_room_id, user_id)
);

create index if not exists idx_session_members_user
  on session_members (user_id) where status = 'active';
create index if not exists idx_session_members_room
  on session_members (session_room_id) where status = 'active';

-- ---------- session_meets (one hang; never deleted when it ends) ----------

create table if not exists session_meets (
  id uuid primary key default gen_random_uuid(),
  session_room_id uuid not null references session_rooms(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by_user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null default '' check (char_length(summary) <= 2000),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_session_meets_one_open
  on session_meets (session_room_id) where ended_at is null;

create index if not exists idx_session_meets_room
  on session_meets (session_room_id, started_at desc);

-- ---------- session_attendance ----------
-- Guest identity is added in 115. v1 rows are always a signed-in member.

create table if not exists session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_meet_id uuid not null references session_meets(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  on_call_seconds integer not null default 0 check (on_call_seconds >= 0),
  unique (session_meet_id, user_id)
);

create index if not exists idx_session_attendance_meet
  on session_attendance (session_meet_id);

-- ---------- session_agenda_items ----------

create table if not exists session_agenda_items (
  id uuid primary key default gen_random_uuid(),
  session_room_id uuid not null references session_rooms(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  sort integer not null default 0,
  done_at timestamptz,
  done_by_user_id uuid references auth.users(id) on delete set null,
  done_in_meet_id uuid references session_meets(id) on delete set null,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_agenda_room
  on session_agenda_items (session_room_id, sort);

-- ---------- session_pins ----------
-- A pin is not a message. message_work_links stays for chat attachments.

create table if not exists session_pins (
  id uuid primary key default gen_random_uuid(),
  session_room_id uuid not null references session_rooms(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  version_id uuid references versions(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 300),
  sort integer not null default 0,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint session_pins_one_target check (
    num_nonnulls(track_id, project_id, version_id, task_id) = 1
  )
);

create index if not exists idx_session_pins_room
  on session_pins (session_room_id, sort);

-- ---------- session_tasks (join only; the task is a real tasks row) ----------

create table if not exists session_tasks (
  id uuid primary key default gen_random_uuid(),
  session_room_id uuid not null references session_rooms(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  created_in_meet_id uuid references session_meets(id) on delete set null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (session_room_id, task_id)
);

create index if not exists idx_session_tasks_room
  on session_tasks (session_room_id, sort);

-- ---------- session_decisions ----------
-- A decision IS a pinned message; this records which hang it belonged to.

create table if not exists session_decisions (
  id uuid primary key default gen_random_uuid(),
  session_room_id uuid not null references session_rooms(id) on delete cascade,
  session_meet_id uuid not null references session_meets(id) on delete cascade,
  message_id uuid not null unique references messages(id) on delete cascade,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_decisions_room
  on session_decisions (session_room_id, created_at desc);

-- ---------- chat weld ----------

alter table conversations
  add column if not exists session_room_id uuid
  references session_rooms(id) on delete cascade;

create unique index if not exists uq_conversations_session_room
  on conversations (session_room_id) where session_room_id is not null;

-- ---------- helpers (RLS oracles) ----------

create or replace function session_profile_for_user(p_user_id uuid, p_artist_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select ap.id
  from artist_profiles ap
  where ap.owner_user_id = p_user_id
  order by
    case when ap.artist_id = p_artist_id then 0
         when ap.profile_kind = 'pro' then 1
         else 2 end,
    ap.created_at
  limit 1;
$$;

create or replace function is_session_member(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_members m
    where m.session_room_id = p_room_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  ) or exists (
    select 1 from session_rooms r
    where r.id = p_room_id and is_artist_owner(r.artist_id)
  );
$$;

create or replace function is_session_host(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_members m
    where m.session_room_id = p_room_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'host'
  ) or exists (
    select 1 from session_rooms r
    where r.id = p_room_id and is_artist_owner(r.artist_id)
  );
$$;

create or replace function session_room_for_meet(p_meet_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select session_room_id from session_meets where id = p_meet_id;
$$;

create or replace function is_session_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c
    where c.id = p_conversation_id
      and c.session_room_id is not null
  );
$$;

revoke execute on function session_profile_for_user(uuid, uuid) from public, anon;
revoke execute on function is_session_member(uuid) from public, anon;
revoke execute on function is_session_host(uuid) from public, anon;
revoke execute on function session_room_for_meet(uuid) from public, anon;
revoke execute on function is_session_conversation(uuid) from public, anon;
grant execute on function session_profile_for_user(uuid, uuid) to authenticated;
grant execute on function is_session_member(uuid) to authenticated;
grant execute on function is_session_host(uuid) to authenticated;
grant execute on function session_room_for_meet(uuid) to authenticated;
grant execute on function is_session_conversation(uuid) to authenticated;

-- Positive discriminator: a group that is not a scene, not a team room,
-- and not a Session. Forgetting the session_room_id clause lets Messages
-- treat a Session chat as an ad-hoc group (add/remove/rename).
create or replace function is_artist_group_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c
    where c.id = p_conversation_id
      and c.kind = 'group'
      and c.scene_id is null
      and c.session_room_id is null
      and not exists (
        select 1 from artist_team_rooms r where r.conversation_id = c.id
      )
  );
$$;

-- ---------- RLS ----------

alter table session_rooms enable row level security;
alter table session_members enable row level security;
alter table session_meets enable row level security;
alter table session_attendance enable row level security;
alter table session_agenda_items enable row level security;
alter table session_pins enable row level security;
alter table session_tasks enable row level security;
alter table session_decisions enable row level security;

drop policy if exists select_session_rooms on session_rooms;
create policy select_session_rooms on session_rooms for select
  to authenticated using (is_session_member(id));

drop policy if exists update_session_rooms on session_rooms;
create policy update_session_rooms on session_rooms for update
  to authenticated using (is_session_member(id)) with check (is_session_member(id));

drop policy if exists insert_session_rooms on session_rooms;
create policy insert_session_rooms on session_rooms for insert
  to authenticated with check (false);

drop policy if exists delete_session_rooms on session_rooms;
create policy delete_session_rooms on session_rooms for delete
  to authenticated using (false);

-- session_members: name auth.uid() and the definer helpers, and NOTHING ELSE.
drop policy if exists select_session_members on session_members;
create policy select_session_members on session_members for select
  to authenticated using (
    user_id = auth.uid() or is_session_member(session_room_id)
  );

drop policy if exists insert_session_members on session_members;
create policy insert_session_members on session_members for insert
  to authenticated with check (false);

drop policy if exists update_session_members on session_members;
create policy update_session_members on session_members for update
  to authenticated using (false) with check (false);

drop policy if exists delete_session_members on session_members;
create policy delete_session_members on session_members for delete
  to authenticated using (false);

drop policy if exists select_session_meets on session_meets;
create policy select_session_meets on session_meets for select
  to authenticated using (is_session_member(session_room_id));

drop policy if exists write_session_meets on session_meets;
create policy write_session_meets on session_meets for all
  to authenticated using (false) with check (false);

drop policy if exists select_session_attendance on session_attendance;
create policy select_session_attendance on session_attendance for select
  to authenticated using (is_session_member(session_room_for_meet(session_meet_id)));

drop policy if exists insert_session_attendance on session_attendance;
create policy insert_session_attendance on session_attendance for insert
  to authenticated with check (
    user_id = auth.uid()
    and is_session_member(session_room_for_meet(session_meet_id))
  );

drop policy if exists update_session_attendance on session_attendance;
create policy update_session_attendance on session_attendance for update
  to authenticated using (
    user_id = auth.uid()
    and is_session_member(session_room_for_meet(session_meet_id))
  ) with check (
    user_id = auth.uid()
    and is_session_member(session_room_for_meet(session_meet_id))
  );

drop policy if exists select_session_agenda on session_agenda_items;
create policy select_session_agenda on session_agenda_items for select
  to authenticated using (is_session_member(session_room_id));

drop policy if exists insert_session_agenda on session_agenda_items;
create policy insert_session_agenda on session_agenda_items for insert
  to authenticated with check (is_session_member(session_room_id));

drop policy if exists update_session_agenda on session_agenda_items;
create policy update_session_agenda on session_agenda_items for update
  to authenticated using (is_session_member(session_room_id))
  with check (is_session_member(session_room_id));

drop policy if exists delete_session_agenda on session_agenda_items;
create policy delete_session_agenda on session_agenda_items for delete
  to authenticated using (is_session_member(session_room_id));

drop policy if exists select_session_pins on session_pins;
create policy select_session_pins on session_pins for select
  to authenticated using (is_session_member(session_room_id));

drop policy if exists insert_session_pins on session_pins;
create policy insert_session_pins on session_pins for insert
  to authenticated with check (is_session_member(session_room_id));

drop policy if exists update_session_pins on session_pins;
create policy update_session_pins on session_pins for update
  to authenticated using (is_session_member(session_room_id))
  with check (is_session_member(session_room_id));

drop policy if exists delete_session_pins on session_pins;
create policy delete_session_pins on session_pins for delete
  to authenticated using (is_session_member(session_room_id));

drop policy if exists select_session_tasks on session_tasks;
create policy select_session_tasks on session_tasks for select
  to authenticated using (is_session_member(session_room_id));

drop policy if exists write_session_tasks on session_tasks;
create policy write_session_tasks on session_tasks for all
  to authenticated using (false) with check (false);

drop policy if exists select_session_decisions on session_decisions;
create policy select_session_decisions on session_decisions for select
  to authenticated using (is_session_member(session_room_id));

drop policy if exists write_session_decisions on session_decisions;
create policy write_session_decisions on session_decisions for all
  to authenticated using (false) with check (false);

-- ---------- chat triggers ----------

create or replace function ensure_session_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_profile uuid;
begin
  select id into v_id from conversations where session_room_id = new.id;
  if v_id is not null then return new; end if;

  v_profile := session_profile_for_user(new.created_by_user_id, new.artist_id);
  if v_profile is null then
    raise exception 'Need a profile before starting a Session' using errcode = '42501';
  end if;

  insert into conversations (kind, title, created_by_profile_id, session_room_id)
  values ('group', new.title, v_profile, new.id)
  on conflict do nothing
  returning id into v_id;

  return new;
end;
$$;

drop trigger if exists trg_ensure_session_conversation on session_rooms;
create trigger trg_ensure_session_conversation after insert on session_rooms
  for each row execute function ensure_session_conversation();

create or replace function sync_session_conversation_title() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.title is distinct from old.title then
    update conversations set title = new.title where session_room_id = new.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sync_session_conversation_title on session_rooms;
create trigger trg_sync_session_conversation_title
  before update of title on session_rooms
  for each row execute function sync_session_conversation_title();

-- Use on conflict (conversation_id, user_id). Migration 110 exists solely
-- because 103 used the profile-scoped key.
create or replace function sync_session_participant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_conv uuid;
  v_role text;
begin
  select id into v_conv from conversations where session_room_id = new.session_room_id;
  if v_conv is null then return new; end if;

  v_role := case when new.role = 'host' then 'admin' else 'member' end;

  if new.status = 'active' then
    insert into conversation_participants (conversation_id, profile_id, user_id, role)
    values (v_conv, new.profile_id, new.user_id, v_role)
    on conflict (conversation_id, user_id) do update
      set left_at = null, role = excluded.role, profile_id = excluded.profile_id;
  else
    update conversation_participants set left_at = coalesce(left_at, now())
    where conversation_id = v_conv and user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_session_participant on session_members;
create trigger trg_sync_session_participant
  after insert or update of status, role on session_members
  for each row execute function sync_session_participant();

-- ---------- pin summaries (titles and artwork only; never file_url) ----------

create or replace function list_session_pin_summaries(p_room uuid)
returns table (
  id uuid,
  sort integer,
  note text,
  track_id uuid,
  project_id uuid,
  version_id uuid,
  task_id uuid,
  title text,
  artwork_path text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_session_member(p_room) then
    raise exception 'Session unavailable' using errcode = '42501';
  end if;
  return query
  select
    p.id,
    p.sort,
    p.note,
    p.track_id,
    p.project_id,
    p.version_id,
    p.task_id,
    coalesce(
      t.title,
      pr.name,
      nullif(trim(concat_ws(' · ', vt.title, v.label)), ''),
      tk.title,
      'Pinned'
    ) as title,
    coalesce(t.artwork_url, vt.artwork_url) as artwork_path
  from session_pins p
  left join tracks t on t.id = p.track_id
  left join projects pr on pr.id = p.project_id
  left join versions v on v.id = p.version_id
  left join tracks vt on vt.id = v.track_id
  left join tasks tk on tk.id = p.task_id
  where p.session_room_id = p_room
  order by p.sort, p.created_at;
end;
$$;

revoke execute on function list_session_pin_summaries(uuid) from public, anon;
grant execute on function list_session_pin_summaries(uuid) to authenticated;

-- ---------- RPCs ----------

create or replace function create_session_room(
  p_artist_id uuid,
  p_space_id uuid,
  p_title text,
  p_purpose text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_profile uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Give this Session a name' using errcode = '23514';
  end if;
  if not is_artist_owner(p_artist_id) and not is_artist_member(p_artist_id) then
    raise exception 'Session unavailable' using errcode = '42501';
  end if;
  if not exists (
    select 1 from spaces s where s.id = p_space_id and s.artist_id = p_artist_id
  ) then
    raise exception 'Pick a space that belongs to this workspace' using errcode = '23514';
  end if;

  v_profile := session_profile_for_user(auth.uid(), p_artist_id);
  if v_profile is null then
    raise exception 'Need a profile before starting a Session' using errcode = '42501';
  end if;

  insert into session_rooms (artist_id, space_id, title, purpose, created_by_user_id)
  values (p_artist_id, p_space_id, v_title, coalesce(p_purpose, ''), auth.uid())
  returning id into v_id;

  insert into session_members (session_room_id, user_id, profile_id, role, status)
  values (v_id, auth.uid(), v_profile, 'host', 'active');

  return v_id;
end;
$$;

create or replace function add_session_member(
  p_room uuid,
  p_user_id uuid,
  p_role text default 'member'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_artist uuid;
  v_profile uuid;
  v_role text := case when p_role = 'host' then 'host' else 'member' end;
begin
  if not is_session_host(p_room) then
    raise exception 'Only a host can add people' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'Pick someone to add' using errcode = '23514';
  end if;
  select artist_id into v_artist from session_rooms where id = p_room;
  v_profile := session_profile_for_user(p_user_id, v_artist);
  if v_profile is null then
    raise exception 'That person needs a TEMPO profile first' using errcode = '42501';
  end if;

  insert into session_members (session_room_id, user_id, profile_id, role, status, joined_at, left_at)
  values (p_room, p_user_id, v_profile, v_role, 'active', now(), null)
  on conflict (session_room_id, user_id) do update
    set status = 'active',
        role = excluded.role,
        profile_id = excluded.profile_id,
        joined_at = now(),
        left_at = null;
end;
$$;

create or replace function remove_session_member(p_room uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_session_host(p_room) then
    raise exception 'Only a host can remove people' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Leave the Session instead of removing yourself' using errcode = '23514';
  end if;
  update session_members
    set status = 'removed', left_at = now()
  where session_room_id = p_room and user_id = p_user_id and status = 'active';
end;
$$;

create or replace function leave_session(p_room uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_was_host boolean;
  v_hosts int;
  v_promote uuid;
begin
  if not exists (
    select 1 from session_members
    where session_room_id = p_room and user_id = auth.uid() and status = 'active'
  ) then
    return;
  end if;

  select role = 'host' into v_was_host
  from session_members
  where session_room_id = p_room and user_id = auth.uid() and status = 'active';

  update session_members
    set status = 'left', left_at = now()
  where session_room_id = p_room and user_id = auth.uid() and status = 'active';

  select count(*) into v_hosts
  from session_members
  where session_room_id = p_room and status = 'active' and role = 'host';

  if coalesce(v_was_host, false) and coalesce(v_hosts, 0) = 0 then
    select user_id into v_promote
    from session_members
    where session_room_id = p_room and status = 'active'
    order by joined_at, user_id
    limit 1;
    if v_promote is not null then
      update session_members set role = 'host'
      where session_room_id = p_room and user_id = v_promote;
    else
      update session_rooms set status = 'archived', updated_at = now() where id = p_room;
    end if;
  end if;
end;
$$;

create or replace function start_session_hang(p_room uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_session_member(p_room) then
    raise exception 'Session unavailable' using errcode = '42501';
  end if;
  select id into v_id from session_meets
  where session_room_id = p_room and ended_at is null;
  if v_id is not null then return v_id; end if;

  insert into session_meets (session_room_id, started_by_user_id)
  values (p_room, auth.uid())
  returning id into v_id;

  update session_rooms
    set last_hang_at = now(), hang_count = hang_count + 1, updated_at = now()
  where id = p_room;

  return v_id;
end;
$$;

create or replace function end_session_hang(p_meet_id uuid, p_summary text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare v_room uuid;
begin
  select session_room_id into v_room from session_meets where id = p_meet_id;
  if v_room is null or not is_session_member(v_room) then
    raise exception 'Hang unavailable' using errcode = '42501';
  end if;
  update session_meets
    set ended_at = coalesce(ended_at, now()),
        summary = coalesce(p_summary, '')
  where id = p_meet_id;
  update session_attendance
    set on_call_seconds = greatest(
      on_call_seconds,
      greatest(0, floor(extract(epoch from (last_seen_at - first_seen_at)))::int)
    )
  where session_meet_id = p_meet_id;
end;
$$;

create or replace function upsert_session_attendance(p_meet_id uuid, p_display_name text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_name text;
begin
  v_room := session_room_for_meet(p_meet_id);
  if v_room is null or not is_session_member(v_room) then
    raise exception 'Hang unavailable' using errcode = '42501';
  end if;
  v_name := nullif(btrim(coalesce(p_display_name, '')), '');
  insert into session_attendance (session_meet_id, user_id, display_name)
  values (p_meet_id, auth.uid(), coalesce(v_name, 'Member'))
  on conflict (session_meet_id, user_id) do update
    set last_seen_at = now(),
        display_name = coalesce(nullif(btrim(excluded.display_name), ''), session_attendance.display_name);
end;
$$;

create or replace function create_session_task(
  p_room uuid,
  p_title text,
  p_assignee uuid default null,
  p_due_date date default null,
  p_category text default 'other'
) returns tasks
language plpgsql security definer set search_path = public as $$
declare
  v_space uuid;
  v_meet uuid;
  v_task tasks%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_sort int;
begin
  if not is_session_member(p_room) then
    raise exception 'Session unavailable' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 then
    raise exception 'Give the task a title' using errcode = '23514';
  end if;
  select space_id into v_space from session_rooms where id = p_room;
  select id into v_meet from session_meets
    where session_room_id = p_room and ended_at is null;

  insert into tasks (title, space_id, category, due_date, status)
  values (v_title, v_space, coalesce(nullif(p_category, ''), 'other'), p_due_date, 'todo')
  returning * into v_task;

  select coalesce(max(sort), -1) + 1 into v_sort
  from session_tasks where session_room_id = p_room;

  insert into session_tasks (session_room_id, task_id, created_in_meet_id, sort)
  values (p_room, v_task.id, v_meet, coalesce(v_sort, 0));

  if p_assignee is not null then
    v_task := assign_artist_task(v_task.id, p_assignee);
  end if;
  return v_task;
end;
$$;

create or replace function log_session_decision(p_room uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_meet uuid;
  v_conv uuid;
  v_profile uuid;
  v_msg uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if not is_session_member(p_room) then
    raise exception 'Session unavailable' using errcode = '42501';
  end if;
  if char_length(v_body) < 1 then
    raise exception 'Write the decision first' using errcode = '23514';
  end if;
  select id into v_meet from session_meets
    where session_room_id = p_room and ended_at is null;
  if v_meet is null then
    raise exception 'Start a hang before logging a decision' using errcode = '23514';
  end if;
  select id into v_conv from conversations where session_room_id = p_room;
  select profile_id into v_profile from session_members
    where session_room_id = p_room and user_id = auth.uid() and status = 'active';
  if v_conv is null or v_profile is null then
    raise exception 'Session chat is not ready' using errcode = '42501';
  end if;

  insert into messages (conversation_id, sender_profile_id, sender_user_id, body, pin_kind)
  values (v_conv, v_profile, auth.uid(), v_body, 'decision')
  returning id into v_msg;

  insert into conversation_message_pins (conversation_id, message_id, pinned_by_user_id)
  values (v_conv, v_msg, auth.uid())
  on conflict do nothing;

  insert into session_decisions (session_room_id, session_meet_id, message_id, created_by_user_id)
  values (p_room, v_meet, v_msg, auth.uid());

  return v_msg;
end;
$$;

revoke execute on function create_session_room(uuid, uuid, text, text) from public, anon;
revoke execute on function add_session_member(uuid, uuid, text) from public, anon;
revoke execute on function remove_session_member(uuid, uuid) from public, anon;
revoke execute on function leave_session(uuid) from public, anon;
revoke execute on function start_session_hang(uuid) from public, anon;
revoke execute on function end_session_hang(uuid, text) from public, anon;
revoke execute on function upsert_session_attendance(uuid, text) from public, anon;
revoke execute on function create_session_task(uuid, text, uuid, date, text) from public, anon;
revoke execute on function log_session_decision(uuid, text) from public, anon;

grant execute on function create_session_room(uuid, uuid, text, text) to authenticated;
grant execute on function add_session_member(uuid, uuid, text) to authenticated;
grant execute on function remove_session_member(uuid, uuid) to authenticated;
grant execute on function leave_session(uuid) to authenticated;
grant execute on function start_session_hang(uuid) to authenticated;
grant execute on function end_session_hang(uuid, text) to authenticated;
grant execute on function upsert_session_attendance(uuid, text) to authenticated;
grant execute on function create_session_task(uuid, text, uuid, date, text) to authenticated;
grant execute on function log_session_decision(uuid, text) to authenticated;

-- Defense in depth: 112 already requires kind='direct', so a Session room
-- (kind='group') cannot be expanded. Spell the Session check anyway so a
-- later edit that loosens the kind test cannot drag a Session into the DM
-- add-member path.
create or replace function expand_direct_conversation_to_group(
  p_from_profile uuid,
  p_conversation_id uuid,
  p_member_profile_id uuid,
  p_include_history boolean default false,
  p_title text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_from_user uuid;
  v_from_name text;
  v_kind text;
  v_session uuid;
  v_peer uuid;
  v_peer_user uuid;
  v_peer_name text;
  v_member_user uuid;
  v_member_name text;
  v_title text;
  v_id uuid;
  v_old messages%rowtype;
  v_new_id uuid;
  v_map jsonb := '{}'::jsonb;
  v_reply uuid;
begin
  if not owns_profile(p_from_profile) then
    raise exception 'Not your profile' using errcode = '42501';
  end if;

  select owner_user_id, display_name into v_from_user, v_from_name
  from artist_profiles where id = p_from_profile;
  if v_from_user is null or v_from_user is distinct from auth.uid() then
    raise exception 'Not your profile' using errcode = '42501';
  end if;

  select kind, session_room_id into v_kind, v_session from conversations where id = p_conversation_id;
  if v_session is not null then
    raise exception 'Session rooms stay on Sessions' using errcode = '23514';
  end if;
  if v_kind is distinct from 'direct' then
    raise exception 'Only a 1:1 chat can become a group this way' using errcode = '23514';
  end if;

  if not exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
      and left_at is null
  ) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  if exists (
    select 1 from artist_team_rooms where conversation_id = p_conversation_id
  ) then
    raise exception 'Team rooms stay on Teams' using errcode = '23514';
  end if;

  select profile_id, user_id into v_peer, v_peer_user
  from conversation_participants
  where conversation_id = p_conversation_id
    and user_id is distinct from auth.uid()
    and left_at is null
  limit 1;
  if v_peer is null then
    raise exception 'No one else in this chat' using errcode = '23514';
  end if;

  if p_member_profile_id is null
     or p_member_profile_id = p_from_profile
     or p_member_profile_id = v_peer then
    raise exception 'Pick someone who is not already in this chat' using errcode = '23514';
  end if;

  if not can_dm_profile(p_member_profile_id) then
    raise exception 'Cannot message this profile' using errcode = '42501';
  end if;

  select owner_user_id, display_name into v_member_user, v_member_name
  from artist_profiles where id = p_member_profile_id;
  if v_member_user is null or v_member_user = v_from_user or v_member_user = v_peer_user then
    raise exception 'Pick someone who is not already in this chat' using errcode = '23514';
  end if;

  select display_name into v_peer_name from artist_profiles where id = v_peer;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then
    v_title := left(
      concat_ws(', ',
        coalesce(nullif(trim(v_peer_name), ''), 'Artist'),
        coalesce(nullif(trim(v_member_name), ''), 'Artist')
      ),
      80
    );
  end if;
  if v_title is null or char_length(trim(v_title)) = 0 then
    v_title := 'Group chat';
  end if;

  insert into conversations (kind, title, created_by_profile_id)
  values ('group', v_title, p_from_profile)
  returning id into v_id;

  insert into conversation_participants (conversation_id, profile_id, user_id, role)
  values
    (v_id, p_from_profile, v_from_user, 'admin'),
    (v_id, v_peer, v_peer_user, 'member'),
    (v_id, p_member_profile_id, v_member_user, 'member')
  on conflict (conversation_id, user_id) do nothing;

  perform notify_profile_owner(
    v_peer,
    p_from_profile,
    'dm_message',
    coalesce(nullif(trim(v_from_name), ''), 'Someone') || ' started a group from your chat',
    v_title,
    'conversation',
    v_id,
    '/messages?c=' || v_id::text,
    'dm:' || v_id::text
  );
  perform notify_profile_owner(
    p_member_profile_id,
    p_from_profile,
    'dm_message',
    coalesce(nullif(trim(v_from_name), ''), 'Someone') || ' added you to ' || v_title,
    'Group chat',
    'conversation',
    v_id,
    '/messages?c=' || v_id::text,
    'dm:' || v_id::text
  );

  if coalesce(p_include_history, false) then
    for v_old in
      select * from (
        select * from messages
        where conversation_id = p_conversation_id
        order by created_at desc, id desc
        limit 1000
      ) recent
      order by created_at asc, id asc
    loop
      v_new_id := gen_random_uuid();
      v_reply := null;
      if v_old.reply_to_message_id is not null then
        v_reply := nullif(v_map ->> v_old.reply_to_message_id::text, '')::uuid;
      end if;
      insert into messages (
        id,
        conversation_id,
        sender_profile_id,
        sender_user_id,
        sender_scene_persona_id,
        body,
        media,
        reply_to_message_id,
        edited_at,
        deleted_at,
        deleted_by_user_id,
        suppress_notification,
        created_at
      ) values (
        v_new_id,
        v_id,
        v_old.sender_profile_id,
        v_old.sender_user_id,
        null,
        v_old.body,
        v_old.media,
        v_reply,
        v_old.edited_at,
        v_old.deleted_at,
        v_old.deleted_by_user_id,
        true,
        v_old.created_at
      );
      v_map := v_map || jsonb_build_object(v_old.id::text, v_new_id::text);
    end loop;
  end if;

  return v_id;
end;
$$;

revoke execute on function expand_direct_conversation_to_group(uuid, uuid, uuid, boolean, text) from public, anon;
grant execute on function expand_direct_conversation_to_group(uuid, uuid, uuid, boolean, text) to authenticated;

insert into schema_migrations(version, name, checksum, applied_by)
values (114, '114_sessions_core', 'initial', 'migration-self-register')
on conflict(version) do nothing;
