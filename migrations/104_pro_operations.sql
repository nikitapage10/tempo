-- TEMPO migration 104: private Pro availability, per-artist preferences, and
-- a cross-artist schedule that only the signed-in Pro can query.

create or replace function valid_working_days(p_days smallint[]) returns boolean
language sql immutable as $$
  select p_days <@ array[1,2,3,4,5,6,7]::smallint[]
    and cardinality(p_days)=(select count(distinct d) from unnest(p_days) d);
$$;

create table if not exists pro_availability (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'available' check(status in('available','limited','unavailable')),
  until_date date, note text check(note is null or char_length(note)<=160), timezone text,
  working_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  share_with_teams boolean not null default false, updated_at timestamptz not null default now(),
  constraint pro_availability_working_days check(valid_working_days(working_days))
);
create or replace function validate_pro_availability() returns trigger
language plpgsql as $$ begin
  if new.user_id<>auth.uid() then raise exception 'Availability owner mismatch'; end if;
  if new.timezone is not null and not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
  new.updated_at=now(); return new;
end; $$;
drop trigger if exists trg_validate_pro_availability on pro_availability;
create trigger trg_validate_pro_availability before insert or update on pro_availability for each row execute function validate_pro_availability();
alter table pro_availability enable row level security;
drop policy if exists own_pro_availability on pro_availability;
create policy own_pro_availability on pro_availability for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists artist_member_preferences (
  artist_id uuid not null references artists(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notification_level text not null default 'assignments_mentions'
    check(notification_level in('all','assignments_mentions','urgent','muted')),
  calendar_color_override text check(calendar_color_override is null or calendar_color_override ~ '^#[0-9A-Fa-f]{6}$'),
  last_pro_home_visit_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(artist_id,user_id)
);
alter table artist_member_preferences enable row level security;
drop policy if exists own_artist_member_preferences on artist_member_preferences;
create policy own_artist_member_preferences on artist_member_preferences for all
  using(user_id=auth.uid()) with check(user_id=auth.uid() and is_artist_member(artist_id));

-- Keep the artist owner in the legacy user_id field while recording the human
-- creator separately. This makes the existing calendar model team-safe.
alter table calendar_events add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;
update calendar_events set created_by_user_id=user_id where created_by_user_id is null;
create or replace function validate_calendar_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_space_owner uuid;v_relation_owner uuid;v_relation_space uuid;
begin
  select a.user_id into v_space_owner from spaces s join artists a on a.id=s.artist_id where s.id=new.space_id;
  if v_space_owner is null then raise exception 'calendar event space is unavailable'; end if;
  if tg_op='INSERT' then new.created_by_user_id:=auth.uid();new.user_id:=v_space_owner; end if;
  if new.user_id<>v_space_owner then raise exception 'calendar event owner mismatch'; end if;
  if not (v_space_owner=auth.uid() or can_write_space_area(new.space_id,'calendar')) then raise exception 'calendar event unavailable' using errcode='42501'; end if;
  if new.track_id is not null then
    select user_id,space_id into v_relation_owner,v_relation_space from tracks where id=new.track_id;
    if v_relation_owner is null or v_relation_owner<>v_space_owner or v_relation_space<>new.space_id then raise exception 'calendar event track is unavailable'; end if;
  end if;
  if new.project_id is not null then
    select user_id,space_id into v_relation_owner,v_relation_space from projects where id=new.project_id;
    if v_relation_owner is null or v_relation_owner<>v_space_owner or v_relation_space<>new.space_id then raise exception 'calendar event project is unavailable'; end if;
  end if;
  if not new.all_day and not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'calendar event timezone is invalid'; end if;
  return new;
end; $$;
drop policy if exists member_delete_own_calendar_events on calendar_events;
create policy member_delete_own_calendar_events on calendar_events for delete using(
  created_by_user_id=auth.uid() and can_write_space_area(space_id,'calendar')
);

create or replace function shared_pro_availability(p_user_ids uuid[]) returns table(
  user_id uuid,status text,until_date date,note text,timezone text,working_days smallint[]
) language sql stable security definer set search_path=public as $$
  select p.user_id,p.status,p.until_date,p.note,p.timezone,p.working_days
  from pro_availability p
  where p.user_id=any(p_user_ids[1:100]) and p.share_with_teams
    and p.user_id<>auth.uid()
    and exists(
      select 1 from artist_members m
      where m.user_id=p.user_id and m.status='active'
        and (is_artist_owner(m.artist_id) or exists(
          select 1 from artist_members mine where mine.artist_id=m.artist_id and mine.user_id=auth.uid() and mine.status='active'
        ))
    );
$$;
revoke execute on function shared_pro_availability(uuid[]) from public,anon;
grant execute on function shared_pro_availability(uuid[]) to authenticated;

create or replace function my_artist_schedule(p_from timestamptz,p_to timestamptz,p_artist_ids uuid[] default null)
returns table(
  event_id uuid,artist_id uuid,artist_name text,space_id uuid,title text,kind text,
  all_day boolean,start_date date,end_date date,starts_at timestamptz,ends_at timestamptz,timezone text,href text
) language plpgsql stable security definer set search_path=public as $$
begin
  if p_to<=p_from or p_to-p_from>interval '180 days' then raise exception 'Schedule range must be 1 to 180 days'; end if;
  return query
  select e.id,a.id,a.name,e.space_id,e.title,e.kind,e.all_day,e.start_date,e.end_date,e.starts_at,e.ends_at,e.timezone,
    ('/calendar?event='||e.id)::text
  from calendar_events e join spaces s on s.id=e.space_id join artists a on a.id=s.artist_id
  where (p_artist_ids is null or a.id=any(p_artist_ids[1:100]))
    and (a.user_id=auth.uid() and a.workspace_kind='personal' or can_read_artist_area(a.id,'calendar'))
    and (case when e.all_day then e.start_date < p_to::date and coalesce(e.end_date,e.start_date)>=p_from::date
      else e.starts_at<p_to and coalesce(e.ends_at,e.starts_at)>p_from end)
  order by coalesce(e.starts_at,e.start_date::timestamp at time zone 'UTC'),e.id limit 1000;
end; $$;
revoke execute on function my_artist_schedule(timestamptz,timestamptz,uuid[]) from public,anon;
grant execute on function my_artist_schedule(timestamptz,timestamptz,uuid[]) to authenticated;

insert into schema_migrations(version,name,checksum,applied_by)
values(104,'104_pro_operations','initial','migration-self-register')
on conflict(version) do nothing;
