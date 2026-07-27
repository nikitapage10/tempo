-- TEMPO migration 008 — release workspace (Prompt 9)

alter table projects
  add column if not exists project_type text not null default 'general'
    check (project_type in ('general','single','ep','album','edit_pack'));

create table if not exists release_details (
  project_id uuid primary key references projects(id) on delete cascade,
  release_date date,
  label_name text,
  distributor text,
  catalog_number text,
  upc text,
  pre_save_url text,
  live_url text,
  pitching_deadline date,
  submitted_at timestamptz,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists release_track_metadata (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  track_number int,
  version_title text,
  isrc text,
  explicit boolean not null default false,
  primary_artist text,
  featured_artists text[] not null default '{}',
  writers text[] not null default '{}',
  producers text[] not null default '{}',
  mix_engineer text,
  mastering_engineer text,
  unique (project_id, track_id)
);

create index if not exists idx_release_meta_project on release_track_metadata (project_id);

alter table release_details enable row level security;
alter table release_track_metadata enable row level security;

drop policy if exists own_release_details on release_details;
create policy own_release_details on release_details for all
  using (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists own_release_track_metadata on release_track_metadata;
create policy own_release_track_metadata on release_track_metadata for all
  using (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  );
