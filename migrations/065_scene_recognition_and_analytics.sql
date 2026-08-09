-- TEMPO migration 065: recognition, activity, and aggregate analytics
-- Depends on 064.

create table if not exists scene_badges (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  name text not null,
  description text,
  icon text not null default 'sparkles',
  color text,
  points int not null default 0 check (points between 0 and 10000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scene_id, name)
);
create table if not exists scene_badge_awards (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  badge_id uuid not null references scene_badges(id) on delete cascade,
  persona_id uuid not null references scene_personas(id) on delete cascade,
  awarded_by_persona_id uuid references scene_personas(id) on delete set null,
  note text,
  awarded_at timestamptz not null default now(),
  unique (badge_id, persona_id)
);
create table if not exists scene_point_events (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  persona_id uuid not null references scene_personas(id) on delete cascade,
  rule_key text not null,
  points int not null check (points between -10000 and 10000),
  source_type text,
  source_id uuid,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (scene_id, idempotency_key)
);
create table if not exists scene_activity_daily (
  scene_id uuid not null references scenes(id) on delete cascade,
  activity_date date not null,
  active_members int not null default 0,
  new_members int not null default 0,
  posts int not null default 0,
  comments int not null default 0,
  messages int not null default 0,
  event_rsvps int not null default 0,
  library_views int not null default 0,
  primary key (scene_id, activity_date)
);

alter table scene_badges enable row level security;
alter table scene_badge_awards enable row level security;
alter table scene_point_events enable row level security;
alter table scene_activity_daily enable row level security;
drop policy if exists view_scene_badges on scene_badges;
drop policy if exists manage_scene_badges on scene_badges;
drop policy if exists view_scene_badge_awards on scene_badge_awards;
drop policy if exists manage_scene_badge_awards on scene_badge_awards;
drop policy if exists view_own_scene_points on scene_point_events;
drop policy if exists view_scene_activity on scene_activity_daily;
create policy view_scene_badges on scene_badges for select to authenticated using (is_scene_member(scene_id));
create policy manage_scene_badges on scene_badges for all to authenticated
  using (is_scene_manager(scene_id)) with check (is_scene_manager(scene_id));
create policy view_scene_badge_awards on scene_badge_awards for select to authenticated using (is_scene_member(scene_id));
create policy manage_scene_badge_awards on scene_badge_awards for all to authenticated
  using (is_scene_manager(scene_id)) with check (is_scene_manager(scene_id));
create policy view_own_scene_points on scene_point_events for select to authenticated
  using (persona_id = scene_persona_id(scene_id) or is_scene_manager(scene_id));
create policy view_scene_activity on scene_activity_daily for select to authenticated using (is_scene_manager(scene_id));

create or replace function award_scene_badge(p_badge_id uuid, p_persona_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_scene uuid; v_awarder uuid; v_points int;
begin
  select scene_id, points into v_scene, v_points from scene_badges where id = p_badge_id and archived_at is null;
  if v_scene is null or not is_scene_manager(v_scene) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from scene_personas where id=p_persona_id and scene_id=v_scene) then raise exception 'Persona does not belong to this Scene'; end if;
  v_awarder := scene_persona_id(v_scene);
  if exists (select 1 from scene_badge_awards where badge_id=p_badge_id and persona_id=p_persona_id) then
    update scene_badge_awards set note=nullif(trim(p_note),''), awarded_by_persona_id=v_awarder, awarded_at=now() where badge_id=p_badge_id and persona_id=p_persona_id;
  else
    insert into scene_badge_awards (scene_id,badge_id,persona_id,awarded_by_persona_id,note) values (v_scene,p_badge_id,p_persona_id,v_awarder,nullif(trim(p_note),''));
    update scene_members set points = points + v_points where scene_id=v_scene and persona_id=p_persona_id;
  end if;
end;
$$;
revoke execute on function award_scene_badge(uuid,uuid,text) from public, anon;
grant execute on function award_scene_badge(uuid,uuid,text) to authenticated;

create or replace function scene_analytics_summary(p_scene_id uuid, p_days int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_scene_manager(p_scene_id) then jsonb_build_object(
    'days', greatest(1, least(p_days, 365)),
    'active_members', coalesce(sum(active_members),0),
    'new_members', coalesce(sum(new_members),0),
    'posts', coalesce(sum(posts),0),
    'comments', coalesce(sum(comments),0),
    'messages', coalesce(sum(messages),0),
    'event_rsvps', coalesce(sum(event_rsvps),0),
    'library_views', coalesce(sum(library_views),0)
  ) else null end
  from scene_activity_daily
  where scene_id = p_scene_id and activity_date >= current_date - greatest(1, least(p_days,365));
$$;
revoke execute on function scene_analytics_summary(uuid,int) from public, anon;
grant execute on function scene_analytics_summary(uuid,int) to authenticated;
