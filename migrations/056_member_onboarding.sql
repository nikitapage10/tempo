-- TEMPO migration 056 — invited-member onboarding
-- Additive. Run after 055. Extends program invites, records onboarding health,
-- and provisions the inviter connection after the new artist profile exists.

alter table invites
  add column if not exists member_role text not null default 'beta_artist',
  add column if not exists welcome_note text;

alter table invites drop constraint if exists invites_member_role_check;
alter table invites add constraint invites_member_role_check
  check (member_role in ('beta_artist', 'team_member', 'administrator'));

create table if not exists member_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invite_id uuid references invites(id) on delete set null,
  eligible boolean not null default true,
  started_at timestamptz not null default now(),
  main_tour_completed_at timestamptz,
  checklist_opened_at timestamptz,
  checklist_steps text[] not null default '{}',
  checklist_dismissed_at timestamptz,
  checklist_completed_at timestamptz,
  page_tours_completed text[] not null default '{}',
  page_tours_skipped text[] not null default '{}',
  welcome_connected_at timestamptz,
  welcome_message_sent_at timestamptz,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_onboarding_health
  on member_onboarding (eligible, checklist_completed_at, last_seen_at desc);

create or replace function touch_member_onboarding_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_member_onboarding_updated_at on member_onboarding;
create trigger trg_member_onboarding_updated_at before update on member_onboarding
  for each row execute function touch_member_onboarding_updated_at();

alter table member_onboarding enable row level security;
-- Deliberately no browser-facing policies. The signed-in onboarding API
-- verifies the caller, then uses the service client for the caller's row.

create or replace function redeem_platform_invite(p_invite_id uuid, p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_invite invites%rowtype;
begin
  select * into v_invite from invites where id = p_invite_id for update;
  if v_invite.id is null
    or v_invite.revoked_at is not null
    or (v_invite.expires_at is not null and v_invite.expires_at <= now())
    or v_invite.used_count >= v_invite.max_uses then
    return false;
  end if;

  insert into invite_redemptions (invite_id, user_id)
  values (p_invite_id, p_user_id)
  on conflict (invite_id, user_id) do nothing;
  if not found then return true; end if;

  update invites set used_count = used_count + 1 where id = p_invite_id;
  insert into member_onboarding (user_id, invite_id, eligible)
  values (p_user_id, p_invite_id, true)
  on conflict (user_id) do update set
    invite_id = excluded.invite_id,
    eligible = true,
    updated_at = now();

  if v_invite.member_role = 'administrator' then
    insert into platform_admins (user_id, email, granted_by, note)
    select p_user_id, coalesce(u.email, v_invite.email, ''), v_invite.created_by,
      'Granted through an administrator invitation'
    from auth.users u where u.id = p_user_id
    on conflict (user_id) do nothing;
  end if;

  return true;
end;
$$;

revoke execute on function redeem_platform_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function redeem_platform_invite(uuid, uuid) to service_role;

-- Called by the authenticated onboarding API through the service role. It is
-- safe to retry: follows, participants, the direct thread, and welcome message
-- are all idempotent.
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

  -- Existing pre-056 accounts should not suddenly receive first-run UI.
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
      conversation_id, sender_profile_id, sender_user_id, body
    ) values (
      v_conversation,
      v_inviter_profile,
      v_inviter_user,
      'Hey — thanks for joining TEMPO. I''m Nikita. If anything feels confusing, or you just want to talk through what you''re working on, reply here anytime. You can also email me at connect@nikita.page.'
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
