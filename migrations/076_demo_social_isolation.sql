-- TEMPO migration 076: keep seeded demo artists out of the live social graph.
--
-- A demo is an owned workspace for previewing the product, not a member
-- identity. If it was created before the real artist, the original onboarding
-- routine could choose it by created_at and make PRESIDENT follow the inviter.

-- Block every future follow where either side is a demo, regardless of which
-- application path attempted the insert.
create or replace function reject_demo_profile_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
    from artist_profiles p
    join artists a on a.id = p.artist_id
    where p.id in (new.follower_profile_id, new.followee_profile_id)
      and a.demo_kind is not null
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_demo_profile_follow on profile_follows;
create trigger trg_reject_demo_profile_follow
  before insert on profile_follows
  for each row execute function reject_demo_profile_follow();

-- Also make the notification function safe on its own. This protects restore
-- and maintenance workflows where triggers may be recreated in a new order.
create or replace function notify_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
  v_handle text;
  v_is_demo boolean;
begin
  select p.display_name, p.handle, (a.demo_kind is not null)
    into v_actor_name, v_handle, v_is_demo
  from artist_profiles p
  join artists a on a.id = p.artist_id
  where p.id = new.follower_profile_id;

  if coalesce(v_is_demo, false) then return new; end if;

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

-- Remove notifications already emitted by demo actors.
delete from notifications n
using artist_profiles p, artists a
where n.actor_profile_id = p.id
  and p.artist_id = a.id
  and a.demo_kind is not null;

-- Never transfer a demo's graph to the owner's real artist. The legitimate
-- inviter connection is created later by provision_member_onboarding using
-- the member's real profile, which is also when its notification belongs.

-- No demo profile should remain in the live graph after the repair.
delete from profile_follows f
using artist_profiles p, artists a
where (f.follower_profile_id = p.id or f.followee_profile_id = p.id)
  and p.artist_id = a.id
  and a.demo_kind is not null;

-- The authoritative onboarding routine now resolves both parties through a
-- non-demo artist, even if a demo profile happens to be older.
create or replace function provision_member_onboarding(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_state member_onboarding%rowtype;
  v_inviter_user uuid;
  v_member_profile uuid;
  v_inviter_profile uuid;
  v_conversation uuid;
  v_key text;
begin
  select * into v_state from member_onboarding where user_id = p_user_id for update;

  if v_state.user_id is null then
    insert into member_onboarding (
      user_id, eligible, main_tour_completed_at, checklist_dismissed_at
    ) values (p_user_id, false, now(), now())
    returning * into v_state;
  else
    update member_onboarding set last_seen_at = now() where user_id = p_user_id;
  end if;

  select i.created_by into v_inviter_user
  from invite_redemptions r
  join invites i on i.id = r.invite_id
  where r.user_id = p_user_id
  order by r.redeemed_at desc
  limit 1;

  if v_inviter_user is null or v_inviter_user = p_user_id then return null; end if;

  select p.id into v_member_profile
  from artist_profiles p
  join artists a on a.id = p.artist_id
  where p.owner_user_id = p_user_id and a.demo_kind is null
  order by a.sort asc, p.created_at asc limit 1;
  if v_member_profile is null then
    insert into artist_profiles (artist_id, owner_user_id, display_name)
    select a.id, a.user_id, a.name from artists a
    where a.user_id = p_user_id and a.demo_kind is null
    order by a.sort asc limit 1
    on conflict (artist_id) do nothing;
    select p.id into v_member_profile
    from artist_profiles p
    join artists a on a.id = p.artist_id
    where p.owner_user_id = p_user_id and a.demo_kind is null
    order by a.sort asc, p.created_at asc limit 1;
  end if;

  select p.id into v_inviter_profile
  from artist_profiles p
  join artists a on a.id = p.artist_id
  where p.owner_user_id = v_inviter_user and a.demo_kind is null
  order by a.sort asc, p.created_at asc limit 1;
  if v_inviter_profile is null then
    insert into artist_profiles (artist_id, owner_user_id, display_name)
    select a.id, a.user_id, a.name from artists a
    where a.user_id = v_inviter_user and a.demo_kind is null
    order by a.sort asc limit 1
    on conflict (artist_id) do nothing;
    select p.id into v_inviter_profile
    from artist_profiles p
    join artists a on a.id = p.artist_id
    where p.owner_user_id = v_inviter_user and a.demo_kind is null
    order by a.sort asc, p.created_at asc limit 1;
  end if;

  if v_member_profile is null or v_inviter_profile is null then return null; end if;

  insert into profile_follows (follower_profile_id, followee_profile_id)
  values
    (v_member_profile, v_inviter_profile),
    (v_inviter_profile, v_member_profile)
  on conflict do nothing;

  v_key := make_direct_key(v_member_profile, v_inviter_profile);
  insert into conversations (kind, direct_key, created_by_profile_id)
  values ('direct', v_key, v_inviter_profile)
  on conflict (direct_key) do nothing
  returning id into v_conversation;
  if v_conversation is null then
    select id into v_conversation from conversations where direct_key = v_key;
  end if;

  insert into conversation_participants (conversation_id, profile_id, user_id, role)
  values
    (v_conversation, v_member_profile, p_user_id, 'member'),
    (v_conversation, v_inviter_profile, v_inviter_user, 'member')
  on conflict do nothing;

  if v_state.welcome_message_sent_at is null then
    insert into messages (
      conversation_id, sender_profile_id, sender_user_id, body, suppress_notification
    ) values (
      v_conversation,
      v_inviter_profile,
      v_inviter_user,
      'Hey, thanks for joining TEMPO! I''m Nikita, the creator of this program, and I''m excited for you to try it out and send me your feedback. If anything feels confusing, just reply here anytime or email me at connect@nikita.page.',
      true
    );
    update member_onboarding set
      welcome_connected_at = now(),
      welcome_message_sent_at = now()
    where user_id = p_user_id;
  elsif v_state.welcome_connected_at is null then
    update member_onboarding set welcome_connected_at = now()
    where user_id = p_user_id;
  end if;

  return v_conversation;
end;
$$;

revoke execute on function provision_member_onboarding(uuid) from public, anon, authenticated;
grant execute on function provision_member_onboarding(uuid) to service_role;

insert into schema_migrations (version, name, checksum, applied_by)
values (76, '076_demo_social_isolation', 'initial', 'migration-self-register')
on conflict (version) do nothing;
