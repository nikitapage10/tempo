-- TEMPO migration 033 — private platform administration
-- Additive only. Run manually in the Supabase SQL editor after migration 032.

create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  note text
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  email text,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  revoked_at timestamptz,
  check (used_count <= max_uses)
);

create table if not exists invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references invites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (invite_id, user_id)
);

create table if not exists account_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  reason text,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references artist_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'post_comment', 'profile')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  action_taken text,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_invites_created on invites (created_at desc);
create index if not exists idx_invite_redemptions_user on invite_redemptions (user_id);
create index if not exists idx_content_reports_queue on content_reports (status, created_at);
create index if not exists idx_admin_audit_created on admin_audit_log (created_at desc);

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
  insert into invite_redemptions (invite_id, user_id) values (p_invite_id, p_user_id)
    on conflict (invite_id, user_id) do nothing;
  if not found then return true; end if;
  update invites set used_count = used_count + 1 where id = p_invite_id;
  return true;
end;
$$;

revoke execute on function redeem_platform_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function redeem_platform_invite(uuid, uuid) to service_role;

alter table platform_admins enable row level security;
alter table invites enable row level security;
alter table invite_redemptions enable row level security;
alter table account_flags enable row level security;
alter table content_reports enable row level security;
alter table admin_audit_log enable row level security;

create or replace function is_platform_admin(p_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = p_user_id);
$$;

revoke execute on function is_platform_admin(uuid) from public, anon;
grant execute on function is_platform_admin(uuid) to authenticated;

drop policy if exists insert_content_reports on content_reports;
create policy insert_content_reports on content_reports for insert
  to authenticated
  with check (
    reporter_profile_id in (select my_profile_ids())
    and (
      (target_type = 'profile' and target_id not in (select my_profile_ids()))
      or (target_type = 'post' and exists (
        select 1 from posts p
        where p.id = target_id and p.author_user_id <> auth.uid() and p.deleted_at is null
      ))
      or (target_type = 'post_comment' and exists (
        select 1 from post_comments c
        where c.id = target_id and c.author_user_id <> auth.uid() and c.deleted_at is null
      ))
    )
  );

-- Intentionally no authenticated policies on platform_admins, invites,
-- invite_redemptions, account_flags, or admin_audit_log. Admin access is
-- service-role-only after the server verifies the caller.
