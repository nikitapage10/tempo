-- TEMPO migration 061: configurable Scene Sections, Groups, and access
-- Depends on 060.

create table if not exists scene_sections (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  type text not null check (type in ('discussion','chat','events','library','showcase','page')),
  name text not null,
  slug text not null,
  description text,
  icon text not null default 'sparkles',
  sort_order int not null default 0,
  post_policy text not null default 'members'
    check (post_policy in ('members','moderators','owners')),
  visibility text not null default 'members'
    check (visibility in ('members','groups')),
  config jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scene_sections_name_len check (char_length(trim(name)) between 1 and 80),
  constraint scene_sections_slug_shape check (
    slug = lower(slug) and slug ~ '^[a-z0-9-]{2,40}$'
    and slug !~ '^-' and slug !~ '-$' and slug !~ '--'
  ),
  constraint scene_sections_description_len check (description is null or char_length(description) <= 500),
  constraint scene_sections_config_size check (octet_length(config::text) <= 32768)
);
create unique index if not exists uq_scene_section_slug
  on scene_sections (scene_id, slug) where archived_at is null;
create index if not exists idx_scene_sections_order
  on scene_sections (scene_id, sort_order) where archived_at is null;

create table if not exists scene_groups (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  color text,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scene_id, slug),
  constraint scene_groups_name_len check (char_length(trim(name)) between 1 and 60),
  constraint scene_groups_slug_shape check (slug = lower(slug) and slug ~ '^[a-z0-9-]{2,40}$')
);

create table if not exists scene_group_members (
  group_id uuid not null references scene_groups(id) on delete cascade,
  scene_id uuid not null references scenes(id) on delete cascade,
  persona_id uuid not null references scene_personas(id) on delete cascade,
  added_by_persona_id uuid references scene_personas(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, persona_id)
);
create index if not exists idx_scene_group_members_persona
  on scene_group_members (persona_id, group_id);

create table if not exists scene_section_groups (
  section_id uuid not null references scene_sections(id) on delete cascade,
  group_id uuid not null references scene_groups(id) on delete cascade,
  scene_id uuid not null references scenes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (section_id, group_id)
);

create or replace function can_view_scene_section(p_section_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from scene_sections s
    where s.id = p_section_id and s.archived_at is null
      and is_scene_member(s.scene_id)
      and (
        s.visibility = 'members'
        or is_scene_manager(s.scene_id)
        or exists (
          select 1 from scene_section_groups sg
          join scene_group_members gm on gm.group_id = sg.group_id
          join scene_personas p on p.id = gm.persona_id
          where sg.section_id = s.id and p.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function can_post_to_scene_section(p_section_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from scene_sections s
    where s.id = p_section_id and can_view_scene_section(s.id)
      and case s.post_policy
        when 'members' then true
        when 'moderators' then is_scene_manager(s.scene_id)
        when 'owners' then is_scene_owner(s.scene_id)
        else false end
  );
$$;

create or replace function can_manage_scene_section(p_section_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from scene_sections s where s.id = p_section_id and is_scene_manager(s.scene_id)
  );
$$;

create or replace function seed_scene_v2_sections() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into scene_sections (scene_id, type, name, slug, icon, sort_order)
  values
    (new.id, 'discussion', 'General', 'general', 'messages-square', 10),
    (new.id, 'chat', 'Chat', 'chat', 'message-circle', 20),
    (new.id, 'events', 'Events', 'events', 'calendar-days', 30)
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists trg_seed_scene_v2_sections on scenes;
create trigger trg_seed_scene_v2_sections after insert on scenes
  for each row execute function seed_scene_v2_sections();

insert into scene_sections (scene_id, type, name, slug, icon, sort_order)
select s.id, x.type, x.name, x.slug, x.icon, x.sort_order
from scenes s cross join (values
  ('discussion','General','general','messages-square',10),
  ('chat','Chat','chat','message-circle',20),
  ('events','Events','events','calendar-days',30)
) as x(type,name,slug,icon,sort_order)
where s.archived_at is null
on conflict do nothing;

alter table scene_sections enable row level security;
alter table scene_groups enable row level security;
alter table scene_group_members enable row level security;
alter table scene_section_groups enable row level security;

create policy select_scene_sections on scene_sections for select to authenticated
  using (can_view_scene_section(id) or is_scene_manager(scene_id));
create policy insert_scene_sections on scene_sections for insert to authenticated
  with check (is_scene_manager(scene_id));
create policy update_scene_sections on scene_sections for update to authenticated
  using (is_scene_manager(scene_id)) with check (is_scene_manager(scene_id));

create policy select_scene_groups on scene_groups for select to authenticated
  using (is_scene_member(scene_id) or is_scene_manager(scene_id));
create policy manage_scene_groups on scene_groups for all to authenticated
  using (is_scene_manager(scene_id)) with check (is_scene_manager(scene_id));

create policy select_scene_group_members on scene_group_members for select to authenticated
  using (is_scene_member(scene_id) or is_scene_manager(scene_id));
create policy manage_scene_group_members on scene_group_members for all to authenticated
  using (is_scene_manager(scene_id)) with check (is_scene_manager(scene_id));

create policy select_scene_section_groups on scene_section_groups for select to authenticated
  using (is_scene_member(scene_id) or is_scene_manager(scene_id));
create policy manage_scene_section_groups on scene_section_groups for all to authenticated
  using (is_scene_manager(scene_id)) with check (is_scene_manager(scene_id));

revoke execute on function can_view_scene_section(uuid) from public, anon;
revoke execute on function can_post_to_scene_section(uuid) from public, anon;
revoke execute on function can_manage_scene_section(uuid) from public, anon;
grant execute on function can_view_scene_section(uuid) to authenticated;
grant execute on function can_post_to_scene_section(uuid) to authenticated;
grant execute on function can_manage_scene_section(uuid) to authenticated;
