-- Sessions V2: the song a room is about and the version worked on per instance.
-- Additive only. Run manually after migration 115.

alter table session_rooms
  add column if not exists track_id uuid references tracks(id) on delete set null;

alter table session_meets
  add column if not exists track_id uuid references tracks(id) on delete set null,
  add column if not exists version_id uuid references versions(id) on delete set null;

create index if not exists idx_session_rooms_track on session_rooms (track_id);
create index if not exists idx_session_meets_track on session_meets (track_id);

-- Keep the existing RPC name for compatibility. A newly opened instance
-- snapshots the room focus and current bounce, while rejoining returns the
-- already-open instance unchanged.
create or replace function start_session_hang(p_room uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_track uuid;
  v_version uuid;
begin
  if not is_session_member(p_room) then
    raise exception 'Session unavailable' using errcode = '42501';
  end if;

  select id into v_id
  from session_meets
  where session_room_id = p_room and ended_at is null;
  if v_id is not null then return v_id; end if;

  select track_id into v_track from session_rooms where id = p_room;
  if v_track is not null then
    select id into v_version
    from versions
    where track_id = v_track and is_current = true
    limit 1;
  end if;

  insert into session_meets (
    session_room_id,
    started_by_user_id,
    track_id,
    version_id
  )
  values (p_room, auth.uid(), v_track, v_version)
  returning id into v_id;

  update session_rooms
    set last_hang_at = now(), hang_count = hang_count + 1, updated_at = now()
  where id = p_room;

  return v_id;
end;
$$;

revoke execute on function start_session_hang(uuid) from public, anon;
grant execute on function start_session_hang(uuid) to authenticated;
