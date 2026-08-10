-- TEMPO migration 070 — Pulse notification preferences (AR-5)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- One row per user for Pulse cadence/category/delivery defaults. Nothing
-- comparable exists today — Calendar reminders have no user-level timezone
-- or quiet-hours concept to reuse (02-TECHNICAL-AND-DATA-DESIGN.md §3.4).
-- Email fields are included now (rather than split into a later migration)
-- because they share one row with in-app Pulse category toggles, but
-- AR-5 only reads/writes the in-app-relevant columns — nothing sends email
-- until AR-6 ships the scheduler/delivery queue.

create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  email_pulse_enabled boolean not null default false,
  digest_frequency text not null default 'off' check (digest_frequency in ('off', 'daily', 'weekly')),
  delivery_local_time time not null default '08:00',
  weekly_delivery_day smallint check (weekly_delivery_day between 1 and 7),
  quiet_hours_start time,
  quiet_hours_end time,
  paused_until date,
  include_entity_names boolean not null default false,
  immediate_guest_feedback boolean not null default false,
  immediate_collaboration boolean not null default false,
  immediate_message_awareness boolean not null default false,
  category_due boolean not null default true,
  category_attention boolean not null default true,
  category_feedback boolean not null default true,
  category_collaboration boolean not null default true,
  category_messages boolean not null default true,
  category_calendar boolean not null default true,
  category_progress boolean not null default true,
  last_digest_window_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_weekly_day_required
    check (digest_frequency <> 'weekly' or weekly_delivery_day is not null),
  constraint notification_preferences_quiet_hours_paired
    check (
      (quiet_hours_start is null and quiet_hours_end is null)
      or (quiet_hours_start is not null and quiet_hours_end is not null)
    )
);

alter table notification_preferences enable row level security;

drop policy if exists own_notification_preferences on notification_preferences;
create policy own_notification_preferences on notification_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function touch_notification_preferences()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_notification_preferences on notification_preferences;
create trigger trg_touch_notification_preferences
  before update on notification_preferences
  for each row execute function touch_notification_preferences();

insert into schema_migrations (version, name, checksum, applied_by)
values (70, '070_notification_preferences', 'initial', 'migration-self-register')
on conflict (version) do nothing;
