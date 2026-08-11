-- TEMPO migration 083: make the recipient picker reopen an existing DM.
-- Additive and rerunnable. Depends on the messaging functions from 031.

create or replace function start_direct_conversation(
  p_from_profile uuid,
  p_to_profile uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_key text;
  v_id uuid;
  v_from_user uuid;
  v_to_user uuid;
begin
  if not owns_profile(p_from_profile) then
    raise exception 'Not your profile' using errcode = '42501';
  end if;
  if not can_dm_profile(p_to_profile) then
    raise exception 'Cannot message this profile' using errcode = '42501';
  end if;

  v_key := make_direct_key(p_from_profile, p_to_profile);
  select id into v_id from conversations where direct_key = v_key;

  if v_id is not null then
    update conversation_participants
    set left_at = null,
        archived_at = null,
        joined_at = coalesce(joined_at, now())
    where conversation_id = v_id
      and profile_id = p_from_profile;
    return v_id;
  end if;

  select owner_user_id into v_from_user from artist_profiles where id = p_from_profile;
  select owner_user_id into v_to_user from artist_profiles where id = p_to_profile;

  insert into conversations (kind, direct_key, created_by_profile_id)
  values ('direct', v_key, p_from_profile)
  on conflict (direct_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from conversations where direct_key = v_key;
  end if;

  insert into conversation_participants (conversation_id, profile_id, user_id, role)
  values
    (v_id, p_from_profile, v_from_user, 'member'),
    (v_id, p_to_profile, v_to_user, 'member')
  on conflict do nothing;

  update conversation_participants
  set left_at = null, archived_at = null
  where conversation_id = v_id and profile_id = p_from_profile;

  return v_id;
end;
$$;

revoke execute on function start_direct_conversation(uuid, uuid) from public, anon;
grant execute on function start_direct_conversation(uuid, uuid) to authenticated;
