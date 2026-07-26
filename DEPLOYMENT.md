# DEPLOYMENT.md — How TEMPO ships

## The pipeline
GitHub → Vercel (app) + Supabase (database, auth, file storage).

- Every push to `main` auto-deploys to production (~1–2 min).
- Every push to any other branch gets its own preview URL — use branches for
  risky changes; merge to main only when the preview looks right.
- Rollback: Vercel → Deployments → pick a previous deploy → Promote to
  Production.

## Environments & secrets
Two environment variables, set in BOTH places:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |

- Locally: `.env.local` (gitignored, never committed).
- Production: Vercel → Project → Settings → Environment Variables.
- Never in code, chat logs, or the repo.

## Database changes (migrations)
The Supabase database is production from day one — it holds real music data.

1. Cursor writes schema changes as numbered SQL files in `/migrations`
   (e.g. `002_add_bpm_index.sql`). It never edits `schema.sql` retroactively
   and never drops/recreates tables.
2. You paste the new migration into Supabase → SQL Editor → Run, once, then
   deploy the matching code.
3. Keep every migration file in the repo forever — that's the history.

## Storage
Private Supabase bucket `audio`. All reads/writes go through `lib/storage.ts`
with 1-hour signed URLs. If storage outgrows the free tier, swap the provider
inside `lib/storage.ts` (e.g. Cloudflare R2) — nothing else changes.

## Routine
1. Change in Cursor → test at localhost:3000 (`npm run dev`).
2. "Commit and push to main" in Cursor chat.
3. Vercel deploys automatically. Check the live URL.
4. Broke something? Promote the previous deployment, then fix calmly.
