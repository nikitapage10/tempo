# TEMPO — catalog backup & recovery runbook

Operator guide for metadata redundancy. Audio bounces are **not** mirrored —
artists keep those in their own DAW / archives.

## What protects what

| Layer | Covers | Does not cover |
|-------|--------|----------------|
| Supabase Pro daily DB backups (7 days) | Full Postgres (nuclear restore of the project) | Storage objects, Auth config quirks, second-level undo |
| Nightly per-user catalog snapshots | Metadata JSON gzip in private Storage (`catalog-backups/{userId}/…`) | Audio files, messaging/social blobs |
| Settings → Your data export | Artist-owned JSON download | Audio files |
| Settings / Import restore | Merge missing rows from a dump or snapshot | Wipe-and-replace; audio rehydration |

## Before first real users

1. Confirm the production project is on **Supabase Pro** (or higher) so daily
   database backups are enabled. Dashboard → Database → Backups.
2. Set `CRON_SECRET` in Vercel (and `.env.local` for manual curls). Vercel Cron
   calls `GET /api/cron/catalog-snapshots` daily at 07:00 UTC (`vercel.json`).
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set (already required for admin/guest).
4. Optional: hit the cron once manually after deploy:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://tempo-ten-sigma.vercel.app/api/cron/catalog-snapshots`

## If a bad migration / code change corrupts data

1. **Stop deploying.** Pause further schema changes.
2. Prefer **per-user snapshot restore** (Settings or support) when only some
   members lost rows — merge is additive and skips existing ids.
3. For project-wide corruption inside the PITR/daily window: use Supabase
   Dashboard → Database → Backups → restore to a new project or follow
   Supabase’s restore flow. Coordinate downtime with members.
4. Do **not** drop or truncate production tables to “fix” things.

## Support: member catalog backups (privacy)

Admin → Users → member → **Catalog backups** shows opaque status only
(snapshot time, size, track/project counts). There is **no** admin download of
catalog JSON — titles, notes, and paths stay out of the Admin console.

- **Save snapshot now** writes a metadata snapshot without returning its body
  (`POST /api/admin/users/{id}/catalog`, audited as `member.catalog_snapshot`).
- **List status:** `GET /api/admin/users/{id}/catalog`
- Member-facing export/restore: Settings → Your data
- Nuclear recovery: Supabase Dashboard → Database → Backups

Note: anyone with the Supabase service role or SQL editor can still query live
tables. Removing Admin download closes the easy peek path in TEMPO; it is not
full cryptographic privacy against database operators.

## Snapshot retention

- Keep ~14 most recent snapshots plus up to 4 weekly buckets.
- Stored under the private `audio` bucket prefix `catalog-backups/` via the
  service role (artists read them only through signed-in API routes).

## Explicit non-goals

- No PITR add-on required for this package (~$100/mo) — enable later if you
  need second-level database rewind.
- No offsite audio redundancy.
- Restore is **merge only** (no typed wipe/replace in v1).
