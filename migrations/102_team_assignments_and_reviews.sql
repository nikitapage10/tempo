-- TEMPO migration 102: Team Operations task assignments, review handoffs,
-- My Work fan-in, and safe membership offboarding.

alter table tasks
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
update tasks set created_by_user_id = user_id where created_by_user_id is null;
create index if not exists idx_tasks_assignee_open_due
  on tasks (assigned_to_user_id, status, due_date) where assigned_to_user_id is not null;
create index if not exists idx_tasks_space_status_due on tasks (space_id, status, due_date);

create or replace function prepare_artist_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if tg_op = 'INSERT' then
    new.created_by_user_id := auth.uid();
    if new.space_id is not null then
      select a.user_id into v_owner from spaces s join artists a on a.id=s.artist_id where s.id=new.space_id;
      if v_owner is not null then new.user_id := v_owner; end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists trg_prepare_artist_task on tasks;
create trigger trg_prepare_artist_task before insert or update on tasks
for each row execute function prepare_artist_task();

create table if not exists task_assignment_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  from_user_id uuid references auth.users(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_assignment_events_task on task_assignment_events(task_id, created_at desc);
alter table task_assignment_events enable row level security;
drop policy if exists read_task_assignment_events on task_assignment_events;
create policy read_task_assignment_events on task_assignment_events for select
  using (can_read_artist_area(artist_id, 'tasks'));

create or replace function is_eligible_artist_assignee(p_artist_id uuid, p_user_id uuid, p_area text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from artists where id=p_artist_id and user_id=p_user_id)
    or exists(select 1 from artist_members where artist_id=p_artist_id and user_id=p_user_id
      and status='active' and coalesce(areas->>p_area,'none') in ('read','write'));
$$;
revoke execute on function is_eligible_artist_assignee(uuid,uuid,text) from public, anon;
grant execute on function is_eligible_artist_assignee(uuid,uuid,text) to authenticated;

create or replace function assign_artist_task(p_task_id uuid, p_assignee_user_id uuid)
returns tasks language plpgsql security definer set search_path=public as $$
declare v tasks%rowtype; v_artist uuid; v_old uuid;
begin
  select * into v from tasks where id=p_task_id for update;
  v_artist := artist_id_for_space(v.space_id);
  if v.id is null or not can_write_artist_area(v_artist,'tasks') then
    raise exception 'Task unavailable' using errcode='42501';
  end if;
  if p_assignee_user_id is not null and not is_eligible_artist_assignee(v_artist,p_assignee_user_id,'tasks') then
    raise exception 'Assignee is not eligible' using errcode='42501';
  end if;
  v_old := v.assigned_to_user_id;
  update tasks set assigned_to_user_id=p_assignee_user_id, assigned_by_user_id=auth.uid(),
    assigned_at=case when p_assignee_user_id is null then null else now() end
    where id=p_task_id returning * into v;
  if v_old is distinct from p_assignee_user_id then
    insert into task_assignment_events(task_id,artist_id,from_user_id,to_user_id,actor_user_id)
      values(v.id,v_artist,v_old,p_assignee_user_id,auth.uid());
  end if;
  return v;
end; $$;

create or replace function set_assigned_task_status(p_task_id uuid, p_status text)
returns tasks language plpgsql security definer set search_path=public as $$
declare v tasks%rowtype; v_artist uuid;
begin
  if p_status not in ('todo','doing','done') then raise exception 'Invalid status'; end if;
  select * into v from tasks where id=p_task_id for update;
  v_artist := artist_id_for_space(v.space_id);
  if v.id is null or v.assigned_to_user_id <> auth.uid()
     or not is_eligible_artist_assignee(v_artist,auth.uid(),'tasks') then
    raise exception 'Task unavailable' using errcode='42501';
  end if;
  update tasks set status=p_status where id=p_task_id returning * into v;
  return v;
end; $$;
revoke execute on function assign_artist_task(uuid,uuid) from public, anon;
revoke execute on function set_assigned_task_status(uuid,text) from public, anon;
grant execute on function assign_artist_task(uuid,uuid) to authenticated;
grant execute on function set_assigned_task_status(uuid,text) to authenticated;

drop policy if exists member_read_tasks on tasks;
create policy member_read_tasks on tasks for select using (can_read_space_area(space_id,'tasks'));
drop policy if exists member_insert_tasks on tasks;
create policy member_insert_tasks on tasks for insert with check (can_write_space_area(space_id,'tasks'));
drop policy if exists member_update_tasks on tasks;
create policy member_update_tasks on tasks for update
  using (can_write_space_area(space_id,'tasks')) with check (can_write_space_area(space_id,'tasks'));

alter table comments add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null;
create index if not exists idx_comments_assignee_open
  on comments(assigned_to_user_id, created_at desc) where assigned_to_user_id is not null and not resolved;

create or replace function set_assigned_comment_resolved(p_comment_id uuid,p_resolved boolean default true)
returns comments language plpgsql security definer set search_path=public as $$
declare v comments%rowtype;v_artist uuid;
begin
  select * into v from comments where id=p_comment_id for update;
  select artist_id_for_track(ver.track_id) into v_artist from versions ver where ver.id=v.version_id;
  if v.id is null or v.assigned_to_user_id<>auth.uid() or not is_eligible_artist_assignee(v_artist,auth.uid(),'feedback') then
    raise exception 'Comment follow-up unavailable' using errcode='42501';
  end if;
  update comments set resolved=p_resolved where id=v.id returning * into v;return v;
end; $$;
revoke execute on function set_assigned_comment_resolved(uuid,boolean) from public,anon;
grant execute on function set_assigned_comment_resolved(uuid,boolean) to authenticated;

create table if not exists review_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  request_type text not null check (request_type in ('bounce_review','version_decision','comment_followup','release_check')),
  track_id uuid references tracks(id) on delete cascade,
  version_id uuid references versions(id) on delete set null,
  comment_id uuid references comments(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  request_text text not null check (char_length(btrim(request_text)) between 1 and 1000),
  due_at timestamptz,
  status text not null default 'open' check(status in ('open','completed','cancelled')),
  result_type text,
  decision_id uuid references version_decisions(id) on delete set null,
  completed_at timestamptz,
  completed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_requests_source_shape check (
    (request_type in ('bounce_review','version_decision') and track_id is not null and project_id is null)
    or (request_type='comment_followup' and track_id is not null and comment_id is not null and project_id is null)
    or (request_type='release_check' and project_id is not null and track_id is null and version_id is null and comment_id is null)
  )
);
create index if not exists idx_review_requests_assignee_open
  on review_requests(assigned_to_user_id,status,due_at) where assigned_to_user_id is not null;
create index if not exists idx_review_requests_artist_waiting
  on review_requests(artist_id,status,created_at desc);

create or replace function validate_review_request() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_area text; v_expected uuid;
begin
  v_expected := artist_id_for_space(new.space_id);
  if v_expected is distinct from new.artist_id then raise exception 'Review source scope mismatch'; end if;
  v_area := case when new.request_type='release_check' then 'releases' else 'feedback' end;
  if tg_op='INSERT' and not can_write_artist_area(new.artist_id,v_area) then
    raise exception 'Review request unavailable' using errcode='42501';
  end if;
  if tg_op='INSERT' and new.assigned_to_user_id is null then raise exception 'Review assignee is required'; end if;
  if new.assigned_to_user_id is not null and not is_eligible_artist_assignee(new.artist_id,new.assigned_to_user_id,v_area) then
    raise exception 'Review assignee is not eligible' using errcode='42501';
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists trg_validate_review_request on review_requests;
create trigger trg_validate_review_request before insert or update on review_requests
for each row execute function validate_review_request();
alter table review_requests enable row level security;
drop policy if exists read_review_requests on review_requests;
create policy read_review_requests on review_requests for select using (
  is_artist_owner(artist_id) or assigned_to_user_id=auth.uid()
  or can_read_artist_area(artist_id,case when request_type='release_check' then 'releases' else 'feedback' end)
);
drop policy if exists create_review_requests on review_requests;
create policy create_review_requests on review_requests for insert with check (
  can_write_artist_area(artist_id,case when request_type='release_check' then 'releases' else 'feedback' end)
);
drop policy if exists manage_review_requests on review_requests;
create policy manage_review_requests on review_requests for update using (
  is_artist_owner(artist_id) or can_write_artist_area(artist_id,case when request_type='release_check' then 'releases' else 'feedback' end)
) with check (
  is_artist_owner(artist_id) or can_write_artist_area(artist_id,case when request_type='release_check' then 'releases' else 'feedback' end)
);

create or replace function complete_review_request(p_request_id uuid, p_result_type text, p_decision_id uuid default null)
returns review_requests language plpgsql security definer set search_path=public as $$
declare v review_requests%rowtype; v_area text;
begin
  select * into v from review_requests where id=p_request_id for update;
  v_area := case when v.request_type='release_check' then 'releases' else 'feedback' end;
  if v.id is null or v.status<>'open' or v.assigned_to_user_id<>auth.uid()
    or not is_eligible_artist_assignee(v.artist_id,auth.uid(),v_area) then
    raise exception 'Review request unavailable' using errcode='42501';
  end if;
  if p_result_type not in ('approved','changes_requested','responded','complete_without_response','ready','not_ready') then
    raise exception 'Invalid review result';
  end if;
  update review_requests set status='completed',result_type=p_result_type,decision_id=p_decision_id,
    completed_at=now(),completed_by_user_id=auth.uid() where id=v.id returning * into v;
  return v;
end; $$;
revoke execute on function complete_review_request(uuid,text,uuid) from public, anon;
grant execute on function complete_review_request(uuid,text,uuid) to authenticated;

create or replace function my_work_inbox(
  p_artist_id uuid default null, p_kind text default null, p_state text default 'open',
  p_before_updated_at timestamptz default null, p_before_id uuid default null, p_limit int default 50
) returns table(
  kind text, source_id uuid, artist_id uuid, artist_name text, artist_emblem_path text,
  space_id uuid, title text, context text, due_at timestamptz, urgency text,
  requested_by_name text, primary_action text, href text, updated_at timestamptz
) language sql stable security definer set search_path=public as $$
  with work as (
    select 'task'::text kind,t.id source_id,a.id artist_id,a.name artist_name,a.emblem_url artist_emblem_path,
      t.space_id,t.title,coalesce(t.notes,'Assigned task') context,
      (t.due_date::timestamp at time zone 'UTC') due_at,null::text requested_by_name,
      'Open task'::text primary_action,('/tasks?edit='||t.id)::text href,t.updated_at
    from tasks t join spaces s on s.id=t.space_id join artists a on a.id=s.artist_id
    where t.assigned_to_user_id=auth.uid() and (p_state<>'open' or t.status<>'done')
      and can_read_artist_area(a.id,'tasks')
    union all
    select 'comment'::text,c.id,a.id,a.name,a.emblem_url,s.id,
      'Comment follow-up'::text,c.text,(null::timestamptz),null::text,'Respond'::text,
      ('/track/'||t.id)::text,c.created_at
    from comments c join versions v on v.id=c.version_id join tracks t on t.id=v.track_id
      join spaces s on s.id=t.space_id join artists a on a.id=s.artist_id
    where c.assigned_to_user_id=auth.uid() and (p_state<>'open' or not c.resolved)
      and can_read_artist_area(a.id,'feedback')
    union all
    select 'review'::text,r.id,a.id,a.name,a.emblem_url,r.space_id,
      case r.request_type when 'bounce_review' then 'Bounce review' when 'version_decision' then 'Version decision'
        when 'comment_followup' then 'Comment follow-up' else 'Release check' end,
      r.request_text,r.due_at,null::text,
      case r.request_type when 'bounce_review' then 'Listen' when 'version_decision' then 'Decide'
        when 'comment_followup' then 'Respond' else 'Review' end,
      ('/team?tab=work&review='||r.id)::text,r.updated_at
    from review_requests r join artists a on a.id=r.artist_id
    where r.assigned_to_user_id=auth.uid() and (p_state<>'open' or r.status='open')
  )
  select w.kind,w.source_id,w.artist_id,w.artist_name,w.artist_emblem_path,w.space_id,w.title,w.context,w.due_at,
    case when w.due_at < now() then 'overdue' when w.due_at::date=current_date then 'today'
      when w.kind='review' and w.due_at is null then 'review_requested'
      when w.due_at is not null then 'upcoming' else 'open' end,
    w.requested_by_name,w.primary_action,w.href,w.updated_at
  from work w
  where (p_artist_id is null or w.artist_id=p_artist_id) and (p_kind is null or w.kind=p_kind)
    and (p_before_updated_at is null or (w.updated_at,w.source_id)<(p_before_updated_at,p_before_id))
  order by case when w.due_at is null then 1 else 0 end,w.due_at,w.updated_at desc,w.source_id
  limit greatest(1,least(p_limit,100));
$$;
revoke execute on function my_work_inbox(uuid,text,text,timestamptz,uuid,int) from public, anon;
grant execute on function my_work_inbox(uuid,text,text,timestamptz,uuid,int) to authenticated;

create or replace function preview_artist_member_offboarding(p_membership_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v artist_members%rowtype;
begin
  select * into v from artist_members where id=p_membership_id;
  if v.id is null or (not is_artist_owner(v.artist_id) and v.user_id<>auth.uid()) then
    raise exception 'Membership unavailable' using errcode='42501';
  end if;
  return jsonb_build_object(
    'tasks',(select count(*) from tasks t where t.assigned_to_user_id=v.user_id and t.status<>'done' and artist_id_for_space(t.space_id)=v.artist_id),
    'reviews',(select count(*) from review_requests r where r.assigned_to_user_id=v.user_id and r.status='open' and r.artist_id=v.artist_id),
    'events',(select count(*) from calendar_events e where e.user_id=v.user_id and artist_id_for_space(e.space_id)=v.artist_id
      and coalesce(e.start_date,e.starts_at::date)>=current_date)
  );
end; $$;

create or replace function finish_artist_membership(p_membership_id uuid,p_assignment_plan jsonb,p_by_owner boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v artist_members%rowtype; v_target uuid; v_tasks int; v_reviews int;
begin
  select * into v from artist_members where id=p_membership_id for update;
  if v.id is null or v.status not in ('pending','active','suspended') then raise exception 'Membership unavailable'; end if;
  if p_by_owner and not is_artist_owner(v.artist_id) then raise exception 'Owner required' using errcode='42501'; end if;
  if not p_by_owner and v.user_id<>auth.uid() then raise exception 'Member required' using errcode='42501'; end if;
  v_target := nullif(p_assignment_plan->>'reassign_to','')::uuid;
  if v_target is not null and not is_eligible_artist_assignee(v.artist_id,v_target,'tasks') then
    raise exception 'Reassignment target is not eligible';
  end if;
  update tasks set assigned_to_user_id=v_target,assigned_by_user_id=auth.uid(),assigned_at=case when v_target is null then null else now() end
    where assigned_to_user_id=v.user_id and status<>'done' and artist_id_for_space(space_id)=v.artist_id;
  get diagnostics v_tasks=row_count;
  update review_requests set assigned_to_user_id=v_target
    where assigned_to_user_id=v.user_id and status='open' and artist_id=v.artist_id;
  get diagnostics v_reviews=row_count;
  update artist_members set status='revoked',revoked_at=now(),revoked_by_user_id=auth.uid(),
    ended_reason=case when p_by_owner then 'ended_by_owner' else 'left_by_member' end where id=v.id;
  insert into artist_membership_events(artist_id,membership_id,subject_user_id,actor_user_id,event_type,changes)
    values(v.artist_id,v.id,v.user_id,auth.uid(),case when p_by_owner then 'revoked' else 'left' end,
      jsonb_build_object('tasks',v_tasks,'reviews',v_reviews));
  return jsonb_build_object('status','revoked','tasks',v_tasks,'reviews',v_reviews);
end; $$;
create or replace function leave_artist_team(p_membership_id uuid,p_assignment_plan jsonb default '{}'::jsonb) returns jsonb
language sql security definer set search_path=public as $$ select finish_artist_membership(p_membership_id,p_assignment_plan,false); $$;
create or replace function end_artist_member_access(p_membership_id uuid,p_assignment_plan jsonb default '{}'::jsonb) returns jsonb
language sql security definer set search_path=public as $$ select finish_artist_membership(p_membership_id,p_assignment_plan,true); $$;
revoke execute on function preview_artist_member_offboarding(uuid) from public,anon;
revoke execute on function finish_artist_membership(uuid,jsonb,boolean) from public,anon;
revoke execute on function leave_artist_team(uuid,jsonb) from public,anon;
revoke execute on function end_artist_member_access(uuid,jsonb) from public,anon;
grant execute on function preview_artist_member_offboarding(uuid) to authenticated;
grant execute on function leave_artist_team(uuid,jsonb) to authenticated;
grant execute on function end_artist_member_access(uuid,jsonb) to authenticated;

insert into schema_migrations(version,name,checksum,applied_by)
values(102,'102_team_assignments_and_reviews','initial','migration-self-register')
on conflict(version) do nothing;
