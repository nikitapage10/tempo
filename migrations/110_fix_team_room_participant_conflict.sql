-- TEMPO migration 110: Team room participant upsert uses the live unique key.
--
-- Migration 060 replaced conversation_participants' primary key
-- (conversation_id, profile_id) with a unique index on (conversation_id, user_id).
-- Migration 103 still upserted on the old pair, so opening a team room failed
-- with "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification". Additive and rerunnable. Run after 109.

create or replace function sync_artist_team_room_participants(p_artist_id uuid) returns int
language plpgsql security definer set search_path=public as $$
declare v_conversation uuid; v_count int;
begin
  select conversation_id into v_conversation from artist_team_rooms where artist_id=p_artist_id;
  if v_conversation is null then return 0; end if;
  -- Leave anyone no longer active for this artist.
  update conversation_participants cp set left_at=now()
  where cp.conversation_id=v_conversation and cp.left_at is null
    and not exists(select 1 from artists a where a.id=p_artist_id and a.user_id=cp.user_id)
    and not exists(select 1 from artist_members m where m.artist_id=p_artist_id and m.user_id=cp.user_id and m.status='active');
  -- One human profile per eligible user; prefer the artist's own profile for
  -- the owner and a Pro profile for members.
  insert into conversation_participants(conversation_id,profile_id,user_id,role,left_at)
  select v_conversation,p.id,p.owner_user_id,
    case when a.user_id=p.owner_user_id then 'admin' else 'member' end,null
  from artists a
  join lateral (
    select distinct on(ap.owner_user_id) ap.* from artist_profiles ap
    where ap.owner_user_id in (
      select a.user_id union select m.user_id from artist_members m where m.artist_id=a.id and m.status='active' and m.user_id is not null
    )
    order by ap.owner_user_id,case when ap.artist_id=a.id then 0 when ap.profile_kind='pro' then 1 else 2 end,ap.created_at
  ) p on true
  where a.id=p_artist_id
    and not exists(select 1 from conversation_participants cp where cp.conversation_id=v_conversation and cp.user_id=p.owner_user_id and cp.left_at is null)
  on conflict(conversation_id,user_id) do update
    set left_at=null, role=excluded.role, profile_id=excluded.profile_id;
  get diagnostics v_count=row_count; return v_count;
end; $$;

revoke execute on function sync_artist_team_room_participants(uuid) from public,anon;

insert into schema_migrations(version,name,checksum,applied_by)
values(110,'110_fix_team_room_participant_conflict','initial','migration-self-register')
on conflict(version) do nothing;
