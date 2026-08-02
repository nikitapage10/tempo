# DEPLOYMENT.md — How TEMPO ships

## The pipeline
GitHub → Vercel (app) + Supabase (database, auth, file storage).

- **Production URL:** https://tempo-ten-sigma.vercel.app (sign-in at `/login`).
- Every push to `main` auto-deploys to production (~1–2 min).
- Every push to any other branch gets its own preview URL — use branches for
  risky changes; merge to main only when the preview looks right.
- Rollback: Vercel → Deployments → pick a previous deploy → Promote to
  Production.
- Absolute links that ship (auth redirects, PWA `start_url`, etc.) must use
  the production URL — never hardcode localhost.

## Environments & secrets
Three environment variables, set in BOTH places:

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Yes (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → "service_role" secret | **No — server only** |

- Locally: `.env.local` (gitignored, never committed).
- Production: Vercel → Project → Settings → Environment Variables.
- Never in code, chat logs, or the repo.
- `SUPABASE_SERVICE_ROLE_KEY` powers **guest review links** (`/review/[token]`
  and `/api/review/*`) — it lets the server look up a guest's token and hand
  back a short-lived playback/download link without ever giving the guest a
  real TEMPO account or exposing your anon key's RLS surface. It is never
  read in any client component or sent to the browser. If this key is
  missing, guest review links will fail closed (generic "not available")
  instead of leaking data.

### Social sign-in (Google / Microsoft / Apple)
The buttons are already in the UI. To make them work, register each provider
with the vendor and enable it in Supabase — full steps in **`OAUTH-SETUP.md`**.
Also allow `https://tempo-ten-sigma.vercel.app/auth/callback` (and localhost
for dev) under Supabase → Authentication → URL Configuration. Password-reset
emails use that same callback with `next=/reset-password`.

## Database changes (migrations)

For v0.62.0 messaging, run `migrations/039_messaging_inbox.sql` after the
support-conversation migration and before deploying the matching app code.

For v0.63.3 realtime messaging, run `migrations/040_realtime_inbox.sql` after
039 so each signed-in user can receive their private notification changefeed.

For v0.60.0, run `migrations/036_support_conversations.sql` before deploying
the matching support-reply code. For invitation email, production also needs
both `RESEND_API_KEY` and `INVITE_FROM_EMAIL`; the latter must use a domain
whose sending status is **Verified** in Resend. Redeploy after changing either
environment variable.
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
3. Vercel deploys automatically. Check https://tempo-ten-sigma.vercel.app.
4. Broke something? Promote the previous deployment, then fix calmly.
