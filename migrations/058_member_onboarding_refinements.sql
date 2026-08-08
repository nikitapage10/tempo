-- TEMPO migration 058: onboarding conversation refinements
-- Run after 057. Keeps official welcome conversations available before an
-- artist joins the network and prevents the seeded welcome DM from also
-- creating a redundant notification-tray item.

alter table messages
  add column if not exists suppress_notification boolean not null default false;

-- Conversation previews and unread counts still update for a quiet message.
-- Only the separate notification tray entry is skipped.
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

  select display_name into v_actor_name from artist_profiles where id = new.sender_profile_id;

  for r in
    select cp.profile_id
    from conversation_participants cp
    where cp.conversation_id = new.conversation_id
      and cp.left_at is null
      and cp.profile_id <> new.sender_profile_id
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

  -- Existing pre-onboarding accounts should not suddenly receive first-run UI.
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

  select id into v_member_profile from artist_profiles
  where owner_user_id = p_user_id order by created_at asc limit 1;
  if v_member_profile is null then
    insert into artist_profiles (artist_id, owner_user_id, display_name)
    select a.id, a.user_id, a.name from artists a
    where a.user_id = p_user_id order by a.sort asc limit 1
    on conflict (artist_id) do nothing;
    select id into v_member_profile from artist_profiles
    where owner_user_id = p_user_id order by created_at asc limit 1;
  end if;

  select id into v_inviter_profile from artist_profiles
  where owner_user_id = v_inviter_user order by created_at asc limit 1;
  if v_inviter_profile is null then
    insert into artist_profiles (artist_id, owner_user_id, display_name)
    select a.id, a.user_id, a.name from artists a
    where a.user_id = v_inviter_user order by a.sort asc limit 1
    on conflict (artist_id) do nothing;
    select id into v_inviter_profile from artist_profiles
    where owner_user_id = v_inviter_user order by created_at asc limit 1;
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

-- Bring the already-seeded beta welcome message in line with the new copy.
update messages
set body = 'Hey, thanks for joining TEMPO! I''m Nikita, the creator of this program, and I''m excited for you to try it out and send me your feedback. If anything feels confusing, just reply here anytime or email me at connect@nikita.page.',
    suppress_notification = true
where body = 'Hey — thanks for joining TEMPO. I''m Nikita. If anything feels confusing, or you just want to talk through what you''re working on, reply here anytime. You can also email me at connect@nikita.page.';

-- Remove only the redundant tray item created alongside an existing seeded
-- welcome. The follow notification remains untouched.
delete from notifications n
using member_onboarding mo
where n.user_id = mo.user_id
  and n.type = 'dm_message'
  and n.body like 'Hey — thanks for joining TEMPO.%'
  and mo.welcome_message_sent_at is not null
  and n.created_at between mo.welcome_message_sent_at - interval '2 minutes'
                       and mo.welcome_message_sent_at + interval '2 minutes';
