-- TEMPO migration 105: optional, private, versioned Pro starter kits.

create table if not exists pro_starter_kits (
  key text not null check(key in('manager','label','publicist','tour_manager','agent','assistant','custom')),
  version int not null check(version>0), display_name text not null,
  home_lens text not null check(home_lens in('work','schedule','roster','campaigns','touring','custom')),
  status text not null default 'draft' check(status in('draft','active','retired')),
  created_at timestamptz not null default now(), primary key(key,version)
);
create unique index if not exists idx_pro_starter_kits_one_active on pro_starter_kits(key) where status='active';
create table if not exists pro_starter_kit_definitions (
  kit_key text not null,kit_version int not null,content_key text not null,
  item_kind text not null check(item_kind in('home_module','saved_view','task_template','checklist_template','project_template','sample_project','sample_task')),
  payload jsonb not null,sort_order int not null default 0,
  primary key(kit_key,kit_version,content_key),
  foreign key(kit_key,kit_version) references pro_starter_kits(key,version) on delete cascade,
  constraint pro_starter_definition_payload check(jsonb_typeof(payload)='object' and not(payload ?| array['html','sql','secret','user_id','artist_id']))
);

insert into pro_starter_kits(key,version,display_name,home_lens,status) values
 ('manager',1,'Manager','work','active'),('label',1,'Label / label owner','campaigns','active'),
 ('publicist',1,'Publicist','campaigns','active'),('tour_manager',1,'Tour manager','touring','active'),
 ('agent',1,'Agent','schedule','active'),('assistant',1,'Assistant','work','active'),
 ('custom',1,'Custom','custom','active') on conflict do nothing;

insert into pro_starter_kit_definitions(kit_key,kit_version,content_key,item_kind,payload,sort_order) values
 ('manager',1,'view:waiting','saved_view','{"name":"Waiting on the team","surface":"work","filters":{"state":"waiting"}}',10),
 ('manager',1,'template:weekly-priorities','task_template','{"name":"Weekly artist priorities","items":["Review open handoffs","Confirm this week''s deadlines","Share the next decision"]}',20),
 ('label',1,'view:release-readiness','saved_view','{"name":"Release readiness","surface":"work","filters":{"kind":"review"}}',10),
 ('label',1,'template:release-check','task_template','{"name":"Release check","items":["Confirm assets","Confirm metadata","Confirm delivery date"]}',20),
 ('publicist',1,'view:campaigns','saved_view','{"name":"Campaign follow-ups","surface":"work","filters":{"kind":"task"}}',10),
 ('publicist',1,'template:press-cycle','task_template','{"name":"Press cycle","items":["Update press list","Prepare pitch angles","Track follow-ups"]}',20),
 ('tour_manager',1,'view:tour-week','saved_view','{"name":"Tour week","surface":"schedule","filters":{"range":"week"}}',10),
 ('tour_manager',1,'template:show-day','checklist_template','{"name":"Show-day handoff","items":["Advance confirmed","Travel checked","Settlement packet ready"]}',20),
 ('agent',1,'view:holds','saved_view','{"name":"Holds and deadlines","surface":"schedule","filters":{"range":"month"}}',10),
 ('agent',1,'template:booking','task_template','{"name":"Booking follow-up","items":["Confirm hold status","Share offer details","Set response deadline"]}',20),
 ('assistant',1,'view:admin','saved_view','{"name":"Admin queue","surface":"work","filters":{"kind":"task"}}',10),
 ('assistant',1,'template:weekly-admin','task_template','{"name":"Weekly admin","items":["Tidy task queue","Check calendar conflicts","Prepare handoffs"]}',20),
 ('custom',1,'view:all-open','saved_view','{"name":"All open work","surface":"work","filters":{"state":"open"}}',10),
 ('manager',1,'sample:orientation','sample_task','{"title":"Review each artist''s Team Brief","category":"admin"}',90),
 ('tour_manager',1,'sample:advance','sample_task','{"title":"Prepare the next show advance","category":"admin"}',90),
 ('publicist',1,'sample:press','sample_task','{"title":"Draft the next campaign handoff","category":"outreach"}',90)
on conflict do nothing;

create table if not exists pro_home_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  primary_lens text not null default 'work' check(primary_lens in('work','schedule','roster','campaigns','touring','custom')),
  module_order text[] not null default array['work','schedule','roster']::text[], hidden_modules text[] not null default '{}'::text[],
  starter_prompt_state text not null default 'unseen' check(starter_prompt_state in('unseen','remind_later','completed','blank')),
  starter_prompt_version int not null default 1,remind_after timestamptz,updated_at timestamptz not null default now()
);
create table if not exists pro_saved_views (
  id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 80),
  surface text not null check(surface in('work','schedule','roster')),
  filters jsonb not null default '{}'::jsonb,starter_content_key text,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(user_id,starter_content_key)
);
alter table templates add column if not exists starter_content_key text;
create unique index if not exists idx_templates_starter_content on templates(user_id,starter_content_key) where starter_content_key is not null;
alter table tasks add column if not exists starter_content_key text;
alter table tasks add column if not exists is_starter_example boolean not null default false;
create unique index if not exists idx_tasks_starter_content on tasks(user_id,starter_content_key) where starter_content_key is not null;

create table if not exists pro_starter_kit_installations (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
  workspace_artist_id uuid not null references artists(id) on delete cascade,selected_kits text[] not null,
  kit_versions jsonb not null,primary_lens text not null,mode text not null check(mode in('templates_only','templates_and_samples')),
  request_id uuid not null,status text not null default 'installed' check(status in('installed','partially_restored','removed_examples')),
  result jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),unique(user_id,request_id)
);
create table if not exists pro_starter_kit_items (
  installation_id uuid not null references pro_starter_kit_installations(id) on delete cascade,
  content_key text not null,target_kind text not null,target_id uuid,disposition text not null check(disposition in('created','already_present','skipped')),
  initial_fingerprint text,primary key(installation_id,content_key)
);

alter table pro_starter_kits enable row level security;
alter table pro_starter_kit_definitions enable row level security;
alter table pro_home_preferences enable row level security;
alter table pro_saved_views enable row level security;
alter table pro_starter_kit_installations enable row level security;
alter table pro_starter_kit_items enable row level security;
drop policy if exists own_pro_home_preferences on pro_home_preferences;
create policy own_pro_home_preferences on pro_home_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists own_pro_saved_views on pro_saved_views;
create policy own_pro_saved_views on pro_saved_views for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists own_pro_kit_installations on pro_starter_kit_installations;
create policy own_pro_kit_installations on pro_starter_kit_installations for select using(user_id=auth.uid());
drop policy if exists own_pro_kit_items on pro_starter_kit_items;
create policy own_pro_kit_items on pro_starter_kit_items for select using(
  exists(select 1 from pro_starter_kit_installations i where i.id=installation_id and i.user_id=auth.uid())
);

create or replace function preview_pro_starter_kits(p_kit_keys text[],p_primary_lens text,p_include_samples boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_items jsonb; v_count int;
begin
  if p_primary_lens not in('work','schedule','roster','campaigns','touring','custom') then raise exception 'Invalid home lens'; end if;
  if p_kit_keys is null or cardinality(p_kit_keys)=0 or exists(select 1 from unnest(p_kit_keys) k where k not in('manager','label','publicist','tour_manager','agent','assistant','custom')) then
    raise exception 'Invalid starter kit selection';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('content_key',d.content_key,'kind',d.item_kind,'payload',d.payload)
    order by d.sort_order,d.content_key),'[]'),count(*) into v_items,v_count
  from (select distinct on(d.content_key) d.* from pro_starter_kit_definitions d join pro_starter_kits k on k.key=d.kit_key and k.version=d.kit_version
    where d.kit_key=any(p_kit_keys) and k.status='active' and (p_include_samples or d.item_kind not like 'sample_%')
    order by d.content_key,d.sort_order,d.kit_key) d;
  return jsonb_build_object('primary_lens',p_primary_lens,'include_samples',p_include_samples,'count',v_count,'items',v_items);
end; $$;

create or replace function install_pro_starter_kits(p_kit_keys text[],p_primary_lens text,p_include_samples boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_existing jsonb;v_workspace uuid;v_space uuid;v_install uuid;v_versions jsonb;v_added int:=0;v_present int:=0;v_skipped int:=0;r record;v_target uuid;v_disposition text;v_result jsonb;
begin
  select result into v_existing from pro_starter_kit_installations where user_id=auth.uid() and request_id=p_request_id;
  if v_existing is not null then return v_existing; end if;
  perform preview_pro_starter_kits(p_kit_keys,p_primary_lens,p_include_samples);
  select id into v_workspace from artists where user_id=auth.uid() and workspace_kind='personal' order by created_at limit 1;
  if v_workspace is null then raise exception 'Personal Pro workspace required' using errcode='42501'; end if;
  select id into v_space from spaces where artist_id=v_workspace order by created_at limit 1;
  if v_space is null then raise exception 'Personal Pro space required' using errcode='42501'; end if;
  select jsonb_object_agg(key,version) into v_versions from pro_starter_kits where key=any(p_kit_keys) and status='active';
  insert into pro_starter_kit_installations(user_id,workspace_artist_id,selected_kits,kit_versions,primary_lens,mode,request_id)
    values(auth.uid(),v_workspace,(select array_agg(distinct u.x order by u.x) from unnest(p_kit_keys) as u(x)),v_versions,p_primary_lens,
      case when p_include_samples then 'templates_and_samples' else 'templates_only' end,p_request_id) returning id into v_install;
  for r in select distinct on(d.content_key)d.* from pro_starter_kit_definitions d join pro_starter_kits k on k.key=d.kit_key and k.version=d.kit_version
    where d.kit_key=any(p_kit_keys) and k.status='active' and (p_include_samples or d.item_kind not like 'sample_%') order by d.content_key,d.sort_order,d.kit_key
  loop
    v_target:=null;v_disposition:='created';
    if r.item_kind='saved_view' then
      insert into pro_saved_views(user_id,name,surface,filters,starter_content_key)
        values(auth.uid(),r.payload->>'name',r.payload->>'surface',coalesce(r.payload->'filters','{}'),r.content_key)
        on conflict(user_id,starter_content_key) where starter_content_key is not null do nothing returning id into v_target;
    elsif r.item_kind in('task_template','checklist_template','project_template') then
      insert into templates(user_id,name,items,starter_content_key)
        values(auth.uid(),r.payload->>'name',coalesce((select jsonb_agg(jsonb_build_object('text',x.value,'sort',x.ordinality-1)) from jsonb_array_elements_text(r.payload->'items') with ordinality x), '[]'),r.content_key)
        on conflict(user_id,starter_content_key) where starter_content_key is not null do nothing returning id into v_target;
    elsif r.item_kind='sample_task' then
      insert into tasks(user_id,space_id,title,category,status,starter_content_key,is_starter_example)
        values(auth.uid(),v_space,r.payload->>'title',coalesce(r.payload->>'category','other'),'todo',r.content_key,true)
        on conflict(user_id,starter_content_key) where starter_content_key is not null do nothing returning id into v_target;
    else
      v_disposition:='skipped';v_skipped:=v_skipped+1;
    end if;
    if v_disposition<>'skipped' and v_target is null then v_disposition:='already_present';v_present:=v_present+1;
    elsif v_disposition='created' then v_added:=v_added+1; end if;
    insert into pro_starter_kit_items(installation_id,content_key,target_kind,target_id,disposition,initial_fingerprint)
      values(v_install,r.content_key,r.item_kind,v_target,v_disposition,case when v_target is null then null else md5(r.payload::text) end);
  end loop;
  insert into pro_home_preferences(user_id,primary_lens,starter_prompt_state,starter_prompt_version)
    values(auth.uid(),p_primary_lens,'completed',1)
    on conflict(user_id) do update set primary_lens=excluded.primary_lens,starter_prompt_state='completed',updated_at=now();
  v_result:=jsonb_build_object('installation_id',v_install,'added',v_added,'already_present',v_present,'skipped',v_skipped);
  update pro_starter_kit_installations set result=v_result where id=v_install;return v_result;
end; $$;

create or replace function restore_pro_starter_kit_items(p_installation_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v pro_starter_kit_installations%rowtype;v_result jsonb;
begin
  select * into v from pro_starter_kit_installations where id=p_installation_id and user_id=auth.uid();
  if v.id is null then raise exception 'Starter-kit installation unavailable' using errcode='42501'; end if;
  v_result:=install_pro_starter_kits(v.selected_kits,v.primary_lens,v.mode='templates_and_samples',p_request_id);
  update pro_starter_kit_installations set status='partially_restored' where user_id=auth.uid() and request_id=p_request_id;
  return v_result;
end; $$;

create or replace function remove_untouched_starter_examples(p_installation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v pro_starter_kit_installations%rowtype;r record;v_removed int:=0;v_kept int:=0;v_fingerprint text;
begin
  select * into v from pro_starter_kit_installations where id=p_installation_id and user_id=auth.uid() for update;
  if v.id is null then raise exception 'Starter-kit installation unavailable' using errcode='42501'; end if;
  for r in select * from pro_starter_kit_items where installation_id=v.id and target_kind='sample_task' and disposition='created' loop
    select md5(jsonb_build_object('title',t.title,'category',t.category)::text) into v_fingerprint
      from tasks t join spaces s on s.id=t.space_id join artists a on a.id=s.artist_id
      where t.id=r.target_id and t.user_id=auth.uid() and t.is_starter_example and a.id=v.workspace_artist_id and a.workspace_kind='personal';
    if v_fingerprint is not null and v_fingerprint=r.initial_fingerprint then
      delete from tasks where id=r.target_id and user_id=auth.uid();v_removed:=v_removed+1;
    else v_kept:=v_kept+1;end if;
  end loop;
  update pro_starter_kit_installations set status='removed_examples',result=result||jsonb_build_object('removed_examples',v_removed,'kept_edited_examples',v_kept) where id=v.id;
  return jsonb_build_object('removed',v_removed,'kept_edited',v_kept);
end; $$;
revoke execute on function preview_pro_starter_kits(text[],text,boolean) from public,anon;
revoke execute on function install_pro_starter_kits(text[],text,boolean,uuid) from public,anon;
revoke execute on function restore_pro_starter_kit_items(uuid,uuid) from public,anon;
revoke execute on function remove_untouched_starter_examples(uuid) from public,anon;
grant execute on function preview_pro_starter_kits(text[],text,boolean) to authenticated;
grant execute on function install_pro_starter_kits(text[],text,boolean,uuid) to authenticated;
grant execute on function restore_pro_starter_kit_items(uuid,uuid) to authenticated;
grant execute on function remove_untouched_starter_examples(uuid) to authenticated;

insert into schema_migrations(version,name,checksum,applied_by)
values(105,'105_pro_starter_kits','initial','migration-self-register')
on conflict(version) do nothing;
