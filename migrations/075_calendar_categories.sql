-- TEMPO migration 075 — customizable calendar categories and colors
-- Additive category storage plus a relaxed event-kind constraint so members
-- can create their own event categories. Existing events and kinds are kept.

create table if not exists calendar_event_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  label text not null,
  color text not null,
  category_group text not null default 'event'
    check (category_group in ('source', 'event')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  constraint calendar_category_key_shape check (key ~ '^[a-z0-9_]{2,40}$'),
  constraint calendar_category_label_length check (char_length(btrim(label)) between 1 and 40),
  constraint calendar_category_color_shape check (color ~ '^#[0-9a-fA-F]{6}$')
);

create index if not exists idx_calendar_event_categories_user_sort
  on calendar_event_categories (user_id, category_group, sort_order);

alter table calendar_event_categories enable row level security;

drop policy if exists own_calendar_event_categories_select on calendar_event_categories;
create policy own_calendar_event_categories_select on calendar_event_categories for select
  using (user_id = auth.uid());
drop policy if exists own_calendar_event_categories_insert on calendar_event_categories;
create policy own_calendar_event_categories_insert on calendar_event_categories for insert
  with check (user_id = auth.uid());
drop policy if exists own_calendar_event_categories_update on calendar_event_categories;
create policy own_calendar_event_categories_update on calendar_event_categories for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_calendar_event_categories_delete on calendar_event_categories;
create policy own_calendar_event_categories_delete on calendar_event_categories for delete
  using (user_id = auth.uid());

alter table calendar_events drop constraint if exists calendar_events_kind_check;
alter table calendar_events add constraint calendar_events_kind_check
  check (kind ~ '^[a-z0-9_]{2,40}$');

insert into schema_migrations (version, name, checksum, applied_by)
values (75, '075_calendar_categories', 'initial', 'migration-self-register')
on conflict (version) do nothing;
