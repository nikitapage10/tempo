-- TEMPO migration 080 — desktop app device registry (Package 1 of the
-- TEMPO Desktop program, see planning/desktop/02-TECHNICAL-AND-DATA-DESIGN.md §4).
-- Additive only. Powers the "Open in desktop" button state on the web app
-- and, in a later package, which device holds a local copy of a bounce.

create table if not exists user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('windows', 'mac')),
  name text not null,
  app_version text not null,
  sync_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_devices_user on user_devices (user_id, last_seen_at desc);

alter table user_devices enable row level security;

-- A device row is only ever visible to, or writable by, the account it
-- belongs to — there is no collaborator concept for devices.
drop policy if exists "user_devices_select_own" on user_devices;
create policy "user_devices_select_own" on user_devices
  for select using (user_id = auth.uid());

drop policy if exists "user_devices_insert_own" on user_devices;
create policy "user_devices_insert_own" on user_devices
  for insert with check (user_id = auth.uid());

drop policy if exists "user_devices_update_own" on user_devices;
create policy "user_devices_update_own" on user_devices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_devices_delete_own" on user_devices;
create policy "user_devices_delete_own" on user_devices
  for delete using (user_id = auth.uid());
