-- TEMPO migration 071 — Pulse email delivery queue (AR-6)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- notification_deliveries: idempotent queue/audit for outbound optional
-- Pulse email. Never stores a rendered body (02-TECHNICAL-AND-DATA-
-- DESIGN.md §3.5). Claimed atomically via status transitions, not a
-- separate lock table — see app/api/cron/pulse-dispatch/route.ts.
--
-- email_suppressions: canonical block list (unsubscribe/bounce/complaint).
-- email_preference_tokens: hashed tokens for no-sign-in unsubscribe links.
--
-- All three are service-role only — no authenticated browser policy on any
-- of them; Settings reads a sanitized status through a guarded route.

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'email' check (channel = 'email'),
  delivery_kind text not null check (
    delivery_kind in ('daily_digest', 'weekly_digest', 'guest_feedback', 'collaboration', 'message_awareness')
  ),
  template_version smallint not null default 1,
  window_start timestamptz,
  window_end timestamptz,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'claimed', 'sent', 'retry', 'suppressed', 'failed', 'cancelled', 'no_content')
  ),
  dedupe_key text not null unique,
  attempt_count smallint not null default 0,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  next_attempt_at timestamptz,
  error_class text,
  error_message text,
  item_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_deliveries_status_scheduled on notification_deliveries (status, scheduled_for);
create index if not exists idx_deliveries_status_next_attempt on notification_deliveries (status, next_attempt_at);
create index if not exists idx_deliveries_user_created on notification_deliveries (user_id, created_at desc);

alter table notification_deliveries enable row level security;
-- Service-role only — no authenticated browser policy.

create or replace function touch_notification_deliveries()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_notification_deliveries on notification_deliveries;
create trigger trg_touch_notification_deliveries
  before update on notification_deliveries
  for each row execute function touch_notification_deliveries();

create table if not exists email_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email_hash text not null,
  reason text not null check (reason in ('unsubscribe', 'hard_bounce', 'complaint', 'operator')),
  provider_event_id text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);

create index if not exists idx_email_suppressions_user on email_suppressions (user_id) where active;
create index if not exists idx_email_suppressions_hash on email_suppressions (email_hash) where active;

alter table email_suppressions enable row level security;
-- Service-role only.

create table if not exists email_preference_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table email_preference_tokens enable row level security;
-- Service-role only. Raw token generated server-side, placed only in email URLs.

insert into schema_migrations (version, name, checksum, applied_by)
values (71, '071_pulse_email_delivery', 'initial', 'migration-self-register')
on conflict (version) do nothing;
