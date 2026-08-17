-- TEMPO migration 108 — shared, customizable task categories and colors
-- Category definitions belong to an artist or Pro home, so everyone working
-- there sees the same names and colors. Existing task categories are kept.

create table if not exists task_categories (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  key text not null,
  label text not null,
  color text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, key),
  constraint task_category_key_shape check (key ~ '^[a-z0-9_]{2,40}$'),
  constraint task_category_label_length check (char_length(btrim(label)) between 1 and 40),
  constraint task_category_color_shape check (color ~ '^#[0-9a-fA-F]{6}$')
);

create index if not exists idx_task_categories_artist_sort
  on task_categories (artist_id, sort_order);

alter table task_categories enable row level security;

drop policy if exists task_categories_read on task_categories;
create policy task_categories_read on task_categories for select
  using (can_read_artist_area(artist_id, 'tasks'));
drop policy if exists task_categories_insert on task_categories;
create policy task_categories_insert on task_categories for insert
  with check (can_write_artist_area(artist_id, 'tasks'));
drop policy if exists task_categories_update on task_categories;
create policy task_categories_update on task_categories for update
  using (can_write_artist_area(artist_id, 'tasks'))
  with check (can_write_artist_area(artist_id, 'tasks'));
drop policy if exists task_categories_delete on task_categories;
create policy task_categories_delete on task_categories for delete
  using (can_write_artist_area(artist_id, 'tasks'));

alter table tasks drop constraint if exists tasks_category_check;
alter table tasks drop constraint if exists tasks_category_key_shape;
alter table tasks add constraint tasks_category_key_shape
  check (category ~ '^[a-z0-9_]{2,40}$');

insert into schema_migrations (version, name, checksum, applied_by)
values (108, '108_custom_task_categories', 'initial', 'migration-self-register')
on conflict (version) do nothing;
