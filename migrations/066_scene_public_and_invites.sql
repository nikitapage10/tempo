-- TEMPO migration 066: public Scenes, invitation links, and readiness
-- Depends on 065.

alter table scenes add column if not exists published_at timestamptz;
alter table scene_sections add column if not exists public_visible boolean not null default false;

create table if not exists scene_invite_links (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  created_by_persona_id uuid not null references scene_personas(id) on delete cascade,
  token_hash text not null unique,
  label text,
  group_id uuid references scene_groups(id) on delete set null,
  max_uses int not null default 1 check (max_uses between 1 and 10000),
  used_count int not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint scene_invite_label_len check (label is null or char_length(label) <= 120)
);
create table if not exists scene_invite_redemptions (
  invite_id uuid not null references scene_invite_links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references scene_personas(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);
alter table scene_invite_links enable row level security;
alter table scene_invite_redemptions enable row level security;
create policy manage_scene_invite_links on scene_invite_links for all to authenticated
  using (is_scene_manager(scene_id)) with check (is_scene_manager(scene_id));
create policy view_own_scene_redemptions on scene_invite_redemptions for select to authenticated
  using (user_id = auth.uid());

create or replace function create_scene_invite_link(p_scene_id uuid, p_label text default null, p_max_uses int default 1, p_expires_in_days int default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text; v_hash text; v_persona uuid;
begin
  if not is_scene_manager(p_scene_id) then raise exception 'Not allowed' using errcode='42501'; end if;
  v_persona := scene_persona_id(p_scene_id);
  v_token := encode(gen_random_bytes(24),'hex');
  v_hash := encode(digest(v_token,'sha256'),'hex');
  insert into scene_invite_links (scene_id,created_by_persona_id,token_hash,label,max_uses,expires_at) values (p_scene_id,v_persona,v_hash,nullif(trim(p_label),''),greatest(1,least(p_max_uses,10000)),case when p_expires_in_days is null then null else now() + make_interval(days => greatest(1,p_expires_in_days)) end);
  return v_token;
end;
$$;
revoke execute on function create_scene_invite_link(uuid,text,int,int) from public, anon;
grant execute on function create_scene_invite_link(uuid,text,int,int) to authenticated;

create or replace function redeem_scene_invite_link(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare v_invite scene_invite_links; v_persona uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v_invite from scene_invite_links where token_hash=encode(digest(p_token,'sha256'),'hex') and revoked_at is null and (expires_at is null or expires_at>now()) and used_count<max_uses for update;
  if v_invite.id is null then raise exception 'This invitation is no longer available'; end if;
  v_persona := ensure_scene_persona(v_invite.scene_id,'Member',null);
  insert into scene_members (scene_id,persona_id,profile_id,user_id,role,status)
  select v_invite.scene_id,v_persona,artist_profile_id,auth.uid(),'member','invited' from scene_personas where id=v_persona
  on conflict (scene_id,user_id) do update set status=case when scene_members.status='banned' then 'banned' else 'invited' end, persona_id=excluded.persona_id;
  select join_scene_v2(v_invite.scene_id,v_persona) into v_status;
  insert into scene_invite_redemptions (invite_id,user_id,persona_id) values (v_invite.id,auth.uid(),v_persona) on conflict do nothing;
  update scene_invite_links set used_count=used_count+1 where id=v_invite.id;
  return (select slug from scenes where id=v_invite.scene_id);
end;
$$;
revoke execute on function redeem_scene_invite_link(text) from public, anon;
grant execute on function redeem_scene_invite_link(text) to authenticated;

create or replace function scenes_v2_ready() returns boolean
language sql stable security definer set search_path = public as $$
  select to_regclass('public.scene_personas') is not null
    and to_regclass('public.scene_sections') is not null
    and to_regclass('public.scene_library_items') is not null
    and to_regclass('public.scene_badges') is not null
    and to_regclass('public.scene_invite_links') is not null;
$$;
revoke execute on function scenes_v2_ready() from public, anon;
grant execute on function scenes_v2_ready() to authenticated;
