-- TEMPO migration 034 — invite email delivery tracking
-- Additive only. Run manually in the Supabase SQL editor after migration 033.

alter table invites
  add column if not exists last_sent_at timestamptz,
  add column if not exists send_count integer not null default 0 check (send_count >= 0),
  add column if not exists email_provider_id text,
  add column if not exists last_send_error text;
