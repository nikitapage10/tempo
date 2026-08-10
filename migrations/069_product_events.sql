-- TEMPO migration 069 — privacy-safe product events (AR-3)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- product_events: append-only, content-free product telemetry. RLS enabled
-- with NO authenticated browser policies at all — every insert goes through
-- the guarded /api/product-events route (service-role, server-validated),
-- per 02-TECHNICAL-AND-DATA-DESIGN.md §3.1. Browser SELECT is never granted.
--
-- activation_guide_preferences: presentation-only state (snooze/hide/
-- restore) for the AR-4 contextual guide. Progress itself is always derived
-- from authoritative tables, never stored here.
--
-- product_event_ingestion_errors: minimal counters so Admin health (AR-2's
-- system-health route) can report reject/duplicate rates without ever
-- storing what was rejected.

create table if not exists product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid references artists(id) on delete set null,
  space_id uuid references spaces(id) on delete set null,
  event_name text not null,
  event_version smallint not null default 1,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  session_id uuid,
  source_surface text,
  properties jsonb not null default '{}'::jsonb,
  dedupe_key text,
  constraint product_events_properties_bounded
    check (octet_length(properties::text) <= 4096),
  constraint product_events_occurred_at_plausible
    check (occurred_at > '2025-01-01'::timestamptz and occurred_at < now() + interval '1 day')
);

create unique index if not exists idx_product_events_user_dedupe
  on product_events (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists idx_product_events_name_time
  on product_events (event_name, occurred_at);
create index if not exists idx_product_events_user_time
  on product_events (user_id, occurred_at);

alter table product_events enable row level security;
-- Deliberately no policies: RLS enabled + zero policies denies all browser
-- access (select/insert/update/delete) for both anon and authenticated
-- roles. Only the service-role client (server-only) can touch this table.

create table if not exists activation_guide_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  hidden_at timestamptz,
  snoozed_until timestamptz,
  completed_acknowledged_at timestamptz,
  restored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, artist_id)
);

alter table activation_guide_preferences enable row level security;

drop policy if exists own_activation_guide_preferences on activation_guide_preferences;
create policy own_activation_guide_preferences on activation_guide_preferences for all
  using (
    user_id = auth.uid()
    and exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  );

create or replace function touch_activation_guide_preferences()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_activation_guide_preferences on activation_guide_preferences;
create trigger trg_touch_activation_guide_preferences
  before update on activation_guide_preferences
  for each row execute function touch_activation_guide_preferences();

create table if not exists product_event_ingestion_errors (
  id uuid primary key default gen_random_uuid(),
  reason text not null check (reason in ('rejected_event_name', 'rejected_shape', 'duplicate')),
  event_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingestion_errors_time on product_event_ingestion_errors (created_at);

alter table product_event_ingestion_errors enable row level security;
-- Service-role only, same reasoning as product_events.

insert into schema_migrations (version, name, checksum, applied_by)
values (69, '069_product_events', 'initial', 'migration-self-register')
on conflict (version) do nothing;
