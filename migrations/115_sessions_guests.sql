-- TEMPO migration 115 — Sessions, part 2: public links and guests
-- Additive only. Run in the Supabase SQL editor after migration 114.
-- Split out because it loosens shared messaging tables (nullable senders)
-- so it can be reviewed and rolled back on its own schedule.
--
-- A Session grants access to THE ROOM, never to anyone's catalog.
-- Guests never receive file_url, a signed audio URL, or an artist id.
-- session_guests has no insert/update/delete policy: service-role only.

-- ---------- session_links ----------

create table if not exists session_links (
  id uuid primary key default gen_random_uuid(),
  session_room_id uuid not null references session_rooms(id) on delete cascade,
  token_hash text not null unique,
  passcode_salt text not null,
  passcode_hash text not null,
  label text not null default '',
  allow_guest_chat boolean not null default true,
  allow_guest_media boolean not null default true,
  max_guests integer check (max_guests is null or max_guests > 0),
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_links_room
  on session_links (session_room_id) where revoked_at is null;

-- ---------- session_guests ----------

create table if not exists session_guests (
  id uuid primary key default gen_random_uuid(),
  session_room_id uuid not null references session_rooms(id) on delete cascade,
  session_link_id uuid not null references session_links(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  guest_key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_session_guests_room
  on session_guests (session_room_id) where revoked_at is null;
create index if not exists idx_session_guests_link
  on session_guests (session_link_id) where revoked_at is null;

alter table session_links enable row level security;
alter table session_guests enable row level security;

drop policy if exists select_session_links on session_links;
create policy select_session_links on session_links for select
  to authenticated using (is_session_host(session_room_id));

drop policy if exists write_session_links on session_links;
create policy write_session_links on session_links for all
  to authenticated using (false) with check (false);

-- No guest write policies on purpose. The public routes use the service role.

drop policy if exists select_session_guests on session_guests;
create policy select_session_guests on session_guests for select
  to authenticated using (is_session_member(session_room_id));

-- ---------- attendance: members XOR guests ----------

alter table session_attendance
  add column if not exists guest_id uuid references session_guests(id) on delete cascade;

alter table session_attendance alter column user_id drop not null;

alter table session_attendance drop constraint if exists session_attendance_session_meet_id_user_id_key;
drop index if exists session_attendance_session_meet_id_user_id_key;

create unique index if not exists uq_session_attendance_member
  on session_attendance (session_meet_id, user_id) where user_id is not null;
create unique index if not exists uq_session_attendance_guest
  on session_attendance (session_meet_id, guest_id) where guest_id is not null;

alter table session_attendance drop constraint if exists session_attendance_actor;
alter table session_attendance add constraint session_attendance_actor check (
  num_nonnulls(user_id, guest_id) = 1
);

-- ---------- messages: guest authorship ----------

alter table messages alter column sender_user_id drop not null;
alter table messages alter column sender_profile_id drop not null;

alter table messages
  add column if not exists sender_session_guest_id uuid
  references session_guests(id) on delete set null;

alter table messages drop constraint if exists messages_sender_identity;
alter table messages add constraint messages_sender_identity check (
  (
    sender_session_guest_id is not null
    and sender_user_id is null
    and sender_profile_id is null
  ) or (
    sender_session_guest_id is null
    and sender_user_id is not null
    and sender_profile_id is not null
  )
);

-- Guest messages have a NULL sender profile. `<> NULL` is NULL, so every
-- participant row was rejected and nobody was notified. `is distinct from`
-- is the fix; the guest display name is the actor label.
create or replace function on_message_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_preview text;
  v_actor_name text;
begin
  v_preview := left(coalesce(nullif(trim(new.body), ''), 'Sent an attachment'), 140);
  update conversations set
    last_message_at = new.created_at,
    last_message_preview = v_preview
  where id = new.conversation_id;

  if new.suppress_notification then
    return new;
  end if;

  if new.sender_session_guest_id is not null then
    select display_name into v_actor_name
    from session_guests where id = new.sender_session_guest_id;
  else
    select display_name into v_actor_name
    from artist_profiles where id = new.sender_profile_id;
  end if;

  for r in
    select cp.profile_id
    from conversation_participants cp
    where cp.conversation_id = new.conversation_id
      and cp.left_at is null
      and cp.profile_id is distinct from new.sender_profile_id
      and not cp.muted
  loop
    perform notify_profile_owner(
      r.profile_id,
      new.sender_profile_id,
      'dm_message',
      coalesce(v_actor_name, 'Someone') || ' sent you a message',
      v_preview,
      'conversation',
      new.conversation_id,
      '/messages?c=' || new.conversation_id::text,
      'dm:' || new.conversation_id::text
    );
  end loop;

  return new;
end;
$$;

-- Guest pin summaries use the service-role client. auth.uid() is null there,
-- so the member check in 114 would always fail. Keep the check for people
-- signed in; let service_role through. Still never returns file_url.
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
  if auth.role() is distinct from 'service_role' and not is_session_member(p_room) then
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

grant execute on function list_session_pin_summaries(uuid) to service_role;

insert into schema_migrations(version, name, checksum, applied_by)
values (115, '115_sessions_guests', 'initial', 'migration-self-register')
on conflict(version) do nothing;
