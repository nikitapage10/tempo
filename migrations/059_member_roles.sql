-- TEMPO migration 059: durable member roles
-- Run after 058. Roles now belong to accounts after redemption and can be
-- changed by an administrator without rewriting the historical invitation.

alter table invites drop constraint if exists invites_member_role_check;
update invites set member_role = 'artist' where member_role = 'beta_artist';
alter table invites alter column member_role set default 'artist';
alter table invites add constraint invites_member_role_check
  check (member_role in ('artist', 'team_member', 'administrator'));

alter table member_onboarding
  add column if not exists member_role text not null default 'artist';
alter table member_onboarding drop constraint if exists member_onboarding_member_role_check;
alter table member_onboarding add constraint member_onboarding_member_role_check
  check (member_role in ('artist', 'team_member', 'administrator'));

-- Preserve the role each existing member accepted at invitation time.
update member_onboarding mo
set member_role = i.member_role
from invites i
where i.id = mo.invite_id;

-- The access grant is authoritative for legacy and environment-bootstrapped
-- administrators, even when they do not have a tracked invitation.
update member_onboarding mo
set member_role = 'administrator'
where exists (
  select 1 from platform_admins pa where pa.user_id = mo.user_id
);

-- One transaction owns both the durable role and the real admin grant so the
-- two cannot drift apart during a promotion or demotion.
create or replace function set_member_role(
  p_user_id uuid,
  p_member_role text,
  p_granted_by uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if p_member_role not in ('artist', 'team_member', 'administrator') then
    raise exception 'Invalid member role' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  insert into member_onboarding (user_id, member_role, eligible)
  values (p_user_id, p_member_role, false)
  on conflict (user_id) do update set
    member_role = excluded.member_role,
    updated_at = now();

  if p_member_role = 'administrator' then
    insert into platform_admins (user_id, email, granted_by, note)
    values (p_user_id, v_email, p_granted_by, 'Granted through member role management')
    on conflict (user_id) do update set
      email = excluded.email,
      granted_by = excluded.granted_by,
      note = excluded.note;
  else
    delete from platform_admins where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function set_member_role(uuid, text, uuid) from public, anon, authenticated;
grant execute on function set_member_role(uuid, text, uuid) to service_role;

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
  insert into member_onboarding (user_id, invite_id, eligible, member_role)
  values (p_user_id, p_invite_id, true, v_invite.member_role)
  on conflict (user_id) do update set
    invite_id = excluded.invite_id,
    eligible = true,
    member_role = excluded.member_role,
    updated_at = now();

  if v_invite.member_role = 'administrator' then
    insert into platform_admins (user_id, email, granted_by, note)
    select p_user_id, coalesce(u.email, v_invite.email, ''), v_invite.created_by,
      'Granted through an administrator invitation'
    from auth.users u where u.id = p_user_id
    on conflict (user_id) do update set
      email = excluded.email,
      granted_by = excluded.granted_by,
      note = excluded.note;
  end if;

  return true;
end;
$$;

revoke execute on function redeem_platform_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function redeem_platform_invite(uuid, uuid) to service_role;
