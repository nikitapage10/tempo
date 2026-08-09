-- TEMPO migration 063: Library, Pages, and Showcase Sections
-- Depends on 062.

create table if not exists scene_library_collections (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  section_id uuid not null references scene_sections(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scene_library_collection_title_len check (char_length(trim(title)) between 1 and 120),
  constraint scene_library_collection_description_len check (description is null or char_length(description) <= 1000)
);
create index if not exists idx_scene_library_collections
  on scene_library_collections (section_id, sort_order) where archived_at is null;

create table if not exists scene_library_items (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  section_id uuid not null references scene_sections(id) on delete cascade,
  collection_id uuid references scene_library_collections(id) on delete set null,
  created_by_persona_id uuid references scene_personas(id) on delete set null,
  kind text not null check (kind in ('article','link','file','audio','video','replay','template')),
  title text not null,
  description text,
  body text,
  external_url text,
  file_url text,
  thumbnail_url text,
  media_meta jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  scheduled_for timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scene_library_item_title_len check (char_length(trim(title)) between 1 and 160),
  constraint scene_library_item_description_len check (description is null or char_length(description) <= 2000),
  constraint scene_library_item_body_len check (body is null or char_length(body) <= 50000),
  constraint scene_library_item_target check (
    kind = 'article' or external_url is not null or file_url is not null or body is not null
  )
);
create index if not exists idx_scene_library_items
  on scene_library_items (section_id, collection_id, sort_order) where archived_at is null;

create table if not exists scene_pages (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  section_id uuid not null unique references scene_sections(id) on delete cascade,
  blocks jsonb not null default '[]'::jsonb,
  draft_blocks jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scene_pages_blocks_size check (
    octet_length(blocks::text) <= 131072 and octet_length(draft_blocks::text) <= 131072
  )
);

create table if not exists scene_showcase_items (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  section_id uuid not null references scene_sections(id) on delete cascade,
  persona_id uuid not null references scene_personas(id) on delete cascade,
  title text not null,
  description text,
  feedback_prompt text,
  external_url text,
  attachment_snapshot jsonb,
  media jsonb not null default '[]'::jsonb,
  visibility text not null default 'members' check (visibility in ('groups','members','public')),
  status text not null default 'published' check (status in ('pending','published','removed')),
  featured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scene_showcase_title_len check (char_length(trim(title)) between 1 and 160),
  constraint scene_showcase_description_len check (description is null or char_length(description) <= 4000),
  constraint scene_showcase_media_len check (jsonb_array_length(media) <= 6)
);
create index if not exists idx_scene_showcase_items
  on scene_showcase_items (section_id, created_at desc) where status = 'published';

alter table scene_library_collections enable row level security;
alter table scene_library_items enable row level security;
alter table scene_pages enable row level security;
alter table scene_showcase_items enable row level security;

create policy view_scene_library_collections on scene_library_collections for select to authenticated
  using (can_view_scene_section(section_id));
create policy manage_scene_library_collections on scene_library_collections for all to authenticated
  using (can_manage_scene_section(section_id)) with check (can_manage_scene_section(section_id));
create policy view_scene_library_items on scene_library_items for select to authenticated
  using (can_view_scene_section(section_id) and archived_at is null and
    (published_at is not null and published_at <= now() or can_manage_scene_section(section_id)));
create policy manage_scene_library_items on scene_library_items for all to authenticated
  using (can_manage_scene_section(section_id)) with check (can_manage_scene_section(section_id));
create policy view_scene_pages on scene_pages for select to authenticated
  using (can_view_scene_section(section_id));
create policy manage_scene_pages on scene_pages for all to authenticated
  using (can_manage_scene_section(section_id)) with check (can_manage_scene_section(section_id));
create policy view_scene_showcase on scene_showcase_items for select to authenticated
  using (can_view_scene_section(section_id) and (status = 'published' or persona_id = scene_persona_id(scene_id) or is_scene_manager(scene_id)));
create policy create_scene_showcase on scene_showcase_items for insert to authenticated
  with check (can_view_scene_section(section_id) and persona_id = scene_persona_id(scene_id));
create policy update_scene_showcase on scene_showcase_items for update to authenticated
  using (persona_id = scene_persona_id(scene_id) or is_scene_manager(scene_id))
  with check (persona_id = scene_persona_id(scene_id) or is_scene_manager(scene_id));
