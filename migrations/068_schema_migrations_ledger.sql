-- TEMPO migration 068 — schema_migrations ledger (AR-2 reliability foundation)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- Nothing today verifies "which migrations has this database actually seen"
-- separately from the /migrations directory itself. This table is that
-- record, so the Admin health surface (AR-2) can report a real
-- expected-vs-applied mismatch instead of assuming the deploy went fine.
--
-- Deliberately does NOT backfill rows for migrations 001-067 — claiming a
-- historical migration was "applied" without independently verifying it
-- against this exact database would be worse than not tracking it at all.
-- Backfilling those, if ever wanted, is its own separately reviewed
-- administrative step, not something this file does automatically.
--
-- From here on, every new migration should end with its own INSERT into
-- this table (see the bottom of this file for the pattern) so the ledger
-- stays accurate without a separate manual step.

create table if not exists schema_migrations (
  version int primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now(),
  applied_by text
);

-- Service-role only. This is operational metadata, not user data — no
-- authenticated browser policy is granted; the Admin health route reads it
-- with the service-role client, same pattern as other admin-only tables.
alter table schema_migrations enable row level security;

-- This migration registers itself once all statements above succeed.
-- checksum is a simple content marker (not a security hash) — good enough to
-- notice "this file's content changed since it was recorded", which should
-- never happen since applied migrations are never edited (see CLAUDE.md).
insert into schema_migrations (version, name, checksum, applied_by)
values (68, '068_schema_migrations_ledger', 'initial', 'migration-self-register')
on conflict (version) do nothing;
