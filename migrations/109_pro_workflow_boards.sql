-- TEMPO migration 109: role-shaped, customizable Pro workflow boards.
-- Additive and rerunnable. Run after 108.

begin;

create table if not exists pro_workflow_preferences (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  initialized_at timestamptz not null default now(),
  primary key(user_id, space_id)
);

create table if not exists pro_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 80),
  description text check(description is null or char_length(description) <= 240),
  starter_key text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_pro_workflows_starter
  on pro_workflows(user_id, space_id, starter_key)
  where starter_key is not null;

create table if not exists pro_workflow_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references pro_workflows(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 60),
  description text check(description is null or char_length(description) <= 160),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pro_workflow_stages_order
  on pro_workflow_stages(workflow_id, sort, created_at);

create table if not exists pro_workflow_cards (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references pro_workflows(id) on delete cascade,
  stage_id uuid not null references pro_workflow_stages(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 1 and 160),
  notes text check(notes is null or char_length(notes) <= 4000),
  due_date date,
  sort int not null default 0,
  is_example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pro_workflow_cards_stage
  on pro_workflow_cards(stage_id, sort, created_at);

create or replace function validate_pro_workflow_scope() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_space uuid; v_kind text;
begin
  select a.user_id, s.id, a.workspace_kind into v_owner, v_space, v_kind
  from spaces s join artists a on a.id=s.artist_id where s.id=new.space_id;
  if v_owner is null or v_owner<>auth.uid() or v_kind<>'personal' then
    raise exception 'Pro workflow space unavailable' using errcode='42501';
  end if;
  new.user_id:=auth.uid(); new.updated_at:=now(); return new;
end; $$;
drop trigger if exists trg_validate_pro_workflow_scope on pro_workflows;
create trigger trg_validate_pro_workflow_scope before insert or update on pro_workflows
for each row execute function validate_pro_workflow_scope();

create or replace function validate_pro_workflow_stage_scope() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from pro_workflows where id=new.workflow_id;
  if v_owner is null or v_owner<>auth.uid() then
    raise exception 'Pro workflow unavailable' using errcode='42501';
  end if;
  new.user_id:=auth.uid(); new.updated_at:=now(); return new;
end; $$;
drop trigger if exists trg_validate_pro_workflow_stage_scope on pro_workflow_stages;
create trigger trg_validate_pro_workflow_stage_scope before insert or update on pro_workflow_stages
for each row execute function validate_pro_workflow_stage_scope();

create or replace function validate_pro_workflow_card_scope() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_stage_workflow uuid;
begin
  select user_id into v_owner from pro_workflows where id=new.workflow_id;
  select workflow_id into v_stage_workflow from pro_workflow_stages where id=new.stage_id;
  if v_owner is null or v_owner<>auth.uid() or v_stage_workflow is distinct from new.workflow_id then
    raise exception 'Pro workflow card unavailable' using errcode='42501';
  end if;
  new.user_id:=auth.uid(); new.updated_at:=now(); return new;
end; $$;
drop trigger if exists trg_validate_pro_workflow_card_scope on pro_workflow_cards;
create trigger trg_validate_pro_workflow_card_scope before insert or update on pro_workflow_cards
for each row execute function validate_pro_workflow_card_scope();

alter table pro_workflow_preferences enable row level security;
alter table pro_workflows enable row level security;
alter table pro_workflow_stages enable row level security;
alter table pro_workflow_cards enable row level security;

drop policy if exists own_pro_workflow_preferences on pro_workflow_preferences;
create policy own_pro_workflow_preferences on pro_workflow_preferences for all
using(user_id=auth.uid())
with check(user_id=auth.uid() and exists(
  select 1 from spaces s join artists a on a.id=s.artist_id
  where s.id=pro_workflow_preferences.space_id
    and a.user_id=auth.uid() and a.workspace_kind='personal'
));
drop policy if exists own_pro_workflows on pro_workflows;
create policy own_pro_workflows on pro_workflows for all
using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists own_pro_workflow_stages on pro_workflow_stages;
create policy own_pro_workflow_stages on pro_workflow_stages for all
using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists own_pro_workflow_cards on pro_workflow_cards;
create policy own_pro_workflow_cards on pro_workflow_cards for all
using(user_id=auth.uid()) with check(user_id=auth.uid());

insert into schema_migrations(version,name,checksum,applied_by)
values(109,'109_pro_workflow_boards','initial','migration-self-register')
on conflict(version) do nothing;

commit;
