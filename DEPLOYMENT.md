# DEPLOYMENT.md — How TEMPO ships

## The pipeline
GitHub → Vercel (app) + Supabase (database, auth, file storage).

- **Production URL:** https://mytempo.dev (sign-in at `/login`).
- Every push to `main` auto-deploys to production (~1–2 min).
- Every push to any other branch gets its own preview URL — use branches for
  risky changes; merge to main only when the preview looks right.
- Rollback: Vercel → Deployments → pick a previous deploy → Promote to
  Production.
- Absolute links that ship (auth redirects, PWA `start_url`, etc.) must use
  the production URL — never hardcode localhost.

## Web and desktop ship as one product

TEMPO Desktop loads the production web app, so an ordinary Vercel deployment
also updates the experience inside the desktop window. Native shell changes
(window, tray, updater, vault, preload bridge, installer) use the separate
`Desktop Release` workflow and public update feed.

Before merging or releasing desktop-sensitive work, follow
**`docs/WEB-DESKTOP-RELEASE-POLICY.md`**. It defines change classification,
old-install compatibility, native-first rollouts, version ownership, the
one-time public release-repository setup, validation, and rollback.

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

### Social sign-in (Google / Microsoft)
The Google and Microsoft buttons are already in the UI. To make them work,
register each provider with the vendor and enable it in Supabase — full steps
in **`OAUTH-SETUP.md`**. Also allow
`https://mytempo.dev/auth/callback` (and localhost for dev)
under Supabase → Authentication → URL Configuration. Password-reset emails use
that same callback with `next=/reset-password`.

## Database changes (migrations)

For the three-type track taxonomy, run `migrations/046_simplify_track_types.sql`
before deploying the matching app code. It converts Collab to Original and
Bootleg to Edit, then narrows the database constraint.

For v0.62.0 messaging, run `migrations/039_messaging_inbox.sql` after the
support-conversation migration and before deploying the matching app code.

For v0.63.3 realtime messaging, run `migrations/040_realtime_inbox.sql` after
039 so each signed-in user can receive their private notification changefeed.

For v0.60.0, run `migrations/036_support_conversations.sql` before deploying
the matching support-reply code.

## Invitation email (Resend)

Production needs:

- `RESEND_API_KEY`
- `INVITE_FROM_EMAIL` — address on a domain whose status is **Verified** in
  Resend (display name optional; bare addresses are sent as `TEMPO <addr>`)
- Optional `INVITE_REPLY_TO_EMAIL` — defaults to the From address so recipients
  can reply into your inbox (avoid `no-reply@…`)

Redeploy after changing any of these.

### Link domain must match the sender

Invite and Pulse links use `NEXT_PUBLIC_SITE_URL` (default
`https://mytempo.dev`). Inbox providers spam-filter mail when those URLs sit on
a different domain than the From address. Admin → Invites warns when they
diverge.

Pick **one** alignment path:

1. **Preferred (current product domain):** Verify `mytempo.dev` in Resend, set
   `INVITE_FROM_EMAIL` to something like `TEMPO <connect@mytempo.dev>`, leave
   `NEXT_PUBLIC_SITE_URL=https://mytempo.dev`.
2. **Keep sending from another domain (e.g. `nikita.page`):** Add a Vercel
   host under that domain (e.g. `app.nikita.page`), set
   `NEXT_PUBLIC_SITE_URL=https://app.nikita.page`, and update Supabase Auth
   redirect allowlists the same way as `OAUTH-SETUP.md` for `mytempo.dev`.

Do **not** merge Resend into the root Outlook SPF on a dual-use domain —
Resend’s return-path SPF lives on the `send` subdomain. Leave open/click
tracking off until you configure a **custom** tracking subdomain in Resend
(shared tracking domains hurt deliverability).

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
3. Vercel deploys automatically. Check https://mytempo.dev.
4. Broke something? Promote the previous deployment, then fix calmly.
