-- TEMPO migration 103: Artist Team Brief and one private team room per artist.

create table if not exists artist_team_briefs (
  artist_id uuid primary key references artists(id) on delete cascade,
  welcome_note text check(welcome_note is null or char_length(welcome_note)<=4000),
  working_norms text check(working_norms is null or char_length(working_norms)<=6000),
  timezone text,
  working_rhythm text check(working_rhythm is null or char_length(working_rhythm)<=1000),
  brief_version int not null default 1 check(brief_version>0),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists artist_team_brief_links (
  id uuid primary key default gen_random_uuid(), artist_id uuid not null references artists(id) on delete cascade,
  label text not null check(char_length(btrim(label)) between 1 and 120),
  url text not null check(char_length(url)<=2000 and url ~* '^https?://'), sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists artist_team_brief_pins (
  id uuid primary key default gen_random_uuid(), artist_id uuid not null references artists(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade, project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade, calendar_event_id uuid references calendar_events(id) on delete cascade,
  note text check(note is null or char_length(note)<=500), sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint artist_team_brief_pins_one_target check(num_nonnulls(track_id,project_id,task_id,calendar_event_id)=1)
);
create table if not exists artist_team_brief_seen (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  last_seen_version int not null default 0, updated_at timestamptz not null default now(),
  primary key(user_id,artist_id)
);

create or replace function prepare_team_brief() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not is_artist_owner(new.artist_id) then raise exception 'Owner required' using errcode='42501'; end if;
  if new.timezone is not null and not exists(select 1 from pg_timezone_names where name=new.timezone) then
    raise exception 'Invalid timezone';
  end if;
  if tg_op='UPDATE' and row(new.welcome_note,new.working_norms,new.timezone,new.working_rhythm)
      is distinct from row(old.welcome_note,old.working_norms,old.timezone,old.working_rhythm) then
    new.brief_version:=old.brief_version+1;
  end if;
  new.updated_by_user_id:=auth.uid(); new.updated_at:=now(); return new;
end; $$;
drop trigger if exists trg_prepare_team_brief on artist_team_briefs;
create trigger trg_prepare_team_brief before insert or update on artist_team_briefs for each row execute function prepare_team_brief();

create or replace function validate_team_brief_pin() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_artist uuid;
begin
  if new.track_id is not null then select s.artist_id into v_artist from tracks t join spaces s on s.id=t.space_id where t.id=new.track_id;
  elsif new.project_id is not null then select s.artist_id into v_artist from projects p join spaces s on s.id=p.space_id where p.id=new.project_id;
  elsif new.task_id is not null then select artist_id_for_space(t.space_id) into v_artist from tasks t where t.id=new.task_id;
  else select artist_id_for_space(e.space_id) into v_artist from calendar_events e where e.id=new.calendar_event_id;
  end if;
  if v_artist is distinct from new.artist_id then raise exception 'Pinned source scope mismatch'; end if;
  new.updated_at:=now(); return new;
end; $$;
drop trigger if exists trg_validate_team_brief_pin on artist_team_brief_pins;
create trigger trg_validate_team_brief_pin before insert or update on artist_team_brief_pins for each row execute function validate_team_brief_pin();

alter table artist_team_briefs enable row level security;
alter table artist_team_brief_links enable row level security;
alter table artist_team_brief_pins enable row level security;
alter table artist_team_brief_seen enable row level security;
drop policy if exists read_team_brief on artist_team_briefs;
create policy read_team_brief on artist_team_briefs for select using(is_artist_owner(artist_id) or is_artist_member(artist_id));
drop policy if exists owner_manage_team_brief on artist_team_briefs;
create policy owner_manage_team_brief on artist_team_briefs for all using(is_artist_owner(artist_id)) with check(is_artist_owner(artist_id));
drop policy if exists read_team_brief_links on artist_team_brief_links;
create policy read_team_brief_links on artist_team_brief_links for select using(is_artist_owner(artist_id) or is_artist_member(artist_id));
drop policy if exists owner_manage_team_brief_links on artist_team_brief_links;
create policy owner_manage_team_brief_links on artist_team_brief_links for all using(is_artist_owner(artist_id)) with check(is_artist_owner(artist_id));
drop policy if exists read_team_brief_pins on artist_team_brief_pins;
create policy read_team_brief_pins on artist_team_brief_pins for select using(is_artist_owner(artist_id) or is_artist_member(artist_id));
drop policy if exists owner_manage_team_brief_pins on artist_team_brief_pins;
create policy owner_manage_team_brief_pins on artist_team_brief_pins for all using(is_artist_owner(artist_id)) with check(is_artist_owner(artist_id));
drop policy if exists own_team_brief_seen on artist_team_brief_seen;
create policy own_team_brief_seen on artist_team_brief_seen for all using(user_id=auth.uid()) with check(user_id=auth.uid() and (is_artist_owner(artist_id) or is_artist_member(artist_id)));

create or replace function artist_team_brief_read(p_artist_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare v_brief jsonb; v_links jsonb; v_pins jsonb;
begin
  select to_jsonb(b) into v_brief from artist_team_briefs b where b.artist_id=p_artist_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'label',l.label,'url',l.url,'sort',l.sort) order by l.sort),'[]')
    into v_links from artist_team_brief_links l where l.artist_id=p_artist_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'track_id',p.track_id,'project_id',p.project_id,
    'task_id',p.task_id,'calendar_event_id',p.calendar_event_id,'note',p.note,'sort',p.sort) order by p.sort),'[]')
    into v_pins from artist_team_brief_pins p where p.artist_id=p_artist_id;
  return jsonb_build_object('brief',coalesce(v_brief,'{}'),'links',v_links,'pins',v_pins,
    'access',effective_artist_access(p_artist_id,auth.uid()));
end; $$;
grant execute on function artist_team_brief_read(uuid) to authenticated;

create table if not exists artist_team_rooms (
  artist_id uuid primary key references artists(id) on delete cascade,
  conversation_id uuid not null unique references conversations(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table artist_team_rooms enable row level security;
drop policy if exists read_artist_team_rooms on artist_team_rooms;
create policy read_artist_team_rooms on artist_team_rooms for select using(is_artist_owner(artist_id) or is_artist_member(artist_id));

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
  on conflict(conversation_id,profile_id) do update set left_at=null,role=excluded.role;
  get diagnostics v_count=row_count; return v_count;
end; $$;

create or replace function ensure_artist_team_room(p_artist_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_profile uuid; v_name text;
begin
  if not (is_artist_owner(p_artist_id) or is_artist_member(p_artist_id)) then
    raise exception 'Team room unavailable' using errcode='42501';
  end if;
  select conversation_id into v_id from artist_team_rooms where artist_id=p_artist_id;
  if v_id is null then
    select p.id,a.name into v_profile,v_name from artists a join artist_profiles p on p.artist_id=a.id where a.id=p_artist_id limit 1;
    if v_profile is null then raise exception 'Artist profile required'; end if;
    insert into conversations(kind,title,created_by_profile_id) values('group',v_name||' team',v_profile) returning id into v_id;
    insert into artist_team_rooms(artist_id,conversation_id,created_by_user_id)
      values(p_artist_id,v_id,auth.uid()) on conflict(artist_id) do nothing;
    select conversation_id into v_id from artist_team_rooms where artist_id=p_artist_id;
  end if;
  perform sync_artist_team_room_participants(p_artist_id); return v_id;
end; $$;

create or replace function sync_artist_team_room_after_membership() returns trigger
language plpgsql security definer set search_path=public as $$ begin
  perform sync_artist_team_room_participants(new.artist_id); return new;
end; $$;
drop trigger if exists trg_sync_artist_team_room_membership on artist_members;
create trigger trg_sync_artist_team_room_membership after insert or update of status,user_id on artist_members
for each row execute function sync_artist_team_room_after_membership();

create table if not exists message_work_links (
  id uuid primary key default gen_random_uuid(), message_id uuid not null references messages(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade, track_id uuid references tracks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade, review_request_id uuid references review_requests(id) on delete cascade,
  calendar_event_id uuid references calendar_events(id) on delete cascade, version_id uuid references versions(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  constraint message_work_links_one_target check(num_nonnulls(task_id,track_id,project_id,review_request_id,calendar_event_id,version_id)=1),
  constraint message_work_links_snapshot_shape check(jsonb_typeof(snapshot)='object' and not (snapshot ?| array['notes','filename','path','email','message']))
);
create index if not exists idx_message_work_links_message on message_work_links(message_id);
alter table message_work_links enable row level security;
drop policy if exists read_message_work_links on message_work_links;
create policy read_message_work_links on message_work_links for select using(
  exists(select 1 from messages m where m.id=message_id and is_conversation_participant(m.conversation_id))
);
drop policy if exists create_message_work_links on message_work_links;
create policy create_message_work_links on message_work_links for insert with check(
  exists(select 1 from messages m where m.id=message_id and m.sender_user_id=auth.uid() and is_conversation_participant(m.conversation_id))
  and (is_artist_owner(artist_id) or is_artist_member(artist_id))
);

alter table messages add column if not exists pin_kind text;
alter table messages drop constraint if exists messages_pin_kind_check;
alter table messages add constraint messages_pin_kind_check check(pin_kind is null or pin_kind in('decision','handoff','reference'));

revoke execute on function sync_artist_team_room_participants(uuid) from public,anon;
revoke execute on function ensure_artist_team_room(uuid) from public,anon;
grant execute on function ensure_artist_team_room(uuid) to authenticated;

insert into schema_migrations(version,name,checksum,applied_by)
values(103,'103_team_brief_and_room','initial','migration-self-register')
on conflict(version) do nothing;
