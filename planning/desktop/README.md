# TEMPO Desktop — specification pack

Status: planning complete; no application code or executable migration SQL is included.

This pack defines the recommended TEMPO Desktop program: a downloadable
Windows/Mac application that runs the TEMPO shell from local disk, keeps a
complete local archive of every bounce and every piece of artwork, syncs in
the background so the workspace is already current when opened, and lets the
core project-management surfaces (Board, Tracks, Projects, Tasks, Calendar)
keep working with no connection at all.

The documents are designed to be handed to a coding agent later, one work
package at a time.

## Documents

- `01-PRODUCT-AND-UX-SPEC.md` — product behavior, surfaces, states, copy
  rules, accessibility.
- `02-TECHNICAL-AND-DATA-DESIGN.md` — architecture, the local vault, schema
  blueprint, sync and offline design, auth, and failure handling.
- `03-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md` — package order, migration gate,
  test matrix, build/release, rollout.
- `04-EXECUTION-PROMPT.md` — a ready-to-use prompt for implementing the
  program later, one package at a time.

## Binding decisions

1. **Not a browser wrapper.** The desktop app runs the TEMPO shell from local
   disk — precached UI, local artwork, local bounce vault — and reconciles
   with the cloud in the background. It is not an `.exe` that just points a
   window at the live site.
2. **Server secrets never ship to the desktop.** Any route that needs the
   Supabase service-role key, `OPENAI_API_KEY`, `CRON_SECRET`, or mail
   credentials keeps running on Vercel and is called over HTTPS. The desktop
   app is a client, never a second server.
3. **Offline scope is deliberately bounded.** Board, Tracks, Projects, Tasks,
   and Calendar work fully offline, reads and writes. Artist, Social, Scenes,
   Stats, Messages, and Assistant are online-only and say so plainly rather
   than showing stale data.
4. **Cloud bounce retention: at most two per track** — the current version and
   the one before it — once the server has a confirmed local copy on record
   for the bounce being evicted. No pinned-milestone exemption, but eviction
   never runs ahead of a confirmed local copy, so an artist who never installs
   the desktop app never silently loses an approved master. See
   `02-TECHNICAL-AND-DATA-DESIGN.md` for the precondition mechanics.
5. **Unsigned installers for the beta.** No Apple notarization or Windows
   code-signing certificate yet; the download page documents the
   Gatekeeper/SmartScreen bypass steps. Revisit before any public (non-invited)
   launch.
6. **Background sync while the app isn't in the foreground**, so opening
   TEMPO shows an already-current workspace. Ships as tray/menu-bar residency
   with launch-at-login, from the first work package — not bolted on later.
   True sync-after-full-quit (an OS-level background agent, independent of the
   app process) is explicitly deferred; see `02` for why.

## Recommended outcome sequence

1. **Shell** — Electron app, tray/background sync scheduler, download button,
   auto-update. Ships first because it's the foundation everything else needs
   and is low-risk on its own: the app is a webview until package 2 adds the
   vault.
2. **Local media vault** — artwork first, then the full bounce archive. This
   is the feature the whole program exists for.
3. **Retention rework** — the cloud two-bounce cap, gated on confirmed local
   copies. Depends on the vault existing.
4. **Offline read**, then **offline write** for the five bounded surfaces.
   Sequenced last and split in two because offline writes (the outbox and
   conflict handling) are the highest-risk, highest-maintenance part of this
   program and should not block the parts of it that are simple wins.
