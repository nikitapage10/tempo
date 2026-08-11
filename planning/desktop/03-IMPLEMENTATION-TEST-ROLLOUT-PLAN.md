# TEMPO Desktop — implementation, test, and rollout plan

## Before package 1: two prerequisites

1. **Version drift.** `lib/version.ts`'s `APP_VERSION` currently reads
   `0.98.0` while `package.json` reads `0.98.2` — they're required to match by
   `.cursorrules` and enforced by the pre-push hook
   (`.claude/hooks/check-release-rules.sh`), so they've drifted since the last
   push. Fix this as the first commit of package 1, unrelated to desktop work,
   so the hook isn't fighting a pre-existing problem while this program is
   underway.
2. **OAuth redirect target.** Decide and configure the loopback-server or
   custom-protocol redirect (see `02-TECHNICAL-AND-DATA-DESIGN.md` §8) in
   Supabase's auth settings before package 1's first-run flow is considered
   done — this blocks Google/Microsoft sign-in on desktop if skipped.

## Work packages

Each package ships independently and updates `CHANGELOG.md`/`PRODUCT.md`/the
version per `.cursorrules` on its own — this plan doesn't bundle several
packages into one release.

### Package 1 — Shell, tray/background sync, download surface

- Electron app skeleton: main process, preload bridge, renderer pointed at
  the production origin, navigation allowlist, `contextIsolation` on.
- Tray/menu-bar residency, launch-at-login, the background sync scheduler
  (interval + Realtime-triggered), the on/off setting.
- `user_devices` table (migration `080`, see below) and device registration
  on sign-in.
- Download button in `components/app-shell.tsx`'s toolbar row, `/download`
  page, platform detection, unsigned-install instructions.
- Auto-update wiring (GitHub Releases as the feed — see Build and release,
  below).
- **No vault, no offline cache yet** — the app is a precached webview at the
  end of this package, which is itself a complete, useful shippable step:
  faster paint, background sync of catalog awareness, no bounce/artwork
  changes.

Acceptance: install on both OSes, sign in (password and OAuth), close-to-tray
and reopen shows no re-login, launch-at-login survives a restart, download
button shows the right state in each of its three modes.

### Package 2 — Local media vault

- Vault directory structure, SQLite index, `lib/storage.ts` desktop provider
  (local-hit-first resolution for reads, vault-then-cloud for writes) per
  `02-TECHNICAL-AND-DATA-DESIGN.md` §3.
- Artwork mirroring first (lower risk, no retention semantics to get right
  yet), then bounce mirroring.
- **The collaborator storage-access gap** (§9 of the technical doc): add the
  server route for signing collaborator-accessible version audio, following
  the existing `artwork-url` / `scenes/media/url` pattern, before bounce
  mirroring ships — otherwise a collaborator's vault silently fails to
  populate for tracks they don't own.
- Storage screen (vault size, relocate, re-download).

Acceptance: upload a bounce on desktop, confirm it's playable with the
network disabled immediately after; a collaborator on a shared track can
mirror that track's bounces into their own vault.

### Package 3 — Migration `080`, retention rework, version-history UI

- Migration `080_desktop_local_vault.sql` (name indicative): `versions.file_url`
  nullable, `versions.cloud_state`, `versions.evicted_at`,
  `version_local_copies`, RLS for both — per
  `02-TECHNICAL-AND-DATA-DESIGN.md` §4. **Additive only**, numbered, handed to
  the user to run manually in the Supabase SQL editor per `.cursorrules` —
  this package stops and confirms before anything downstream of the migration
  ships.
- `lib/version-prune.ts` rework to the two-phase model (§5): unbounded row
  retention, cloud eviction capped at two `in_cloud` versions and gated on a
  confirmed `version_local_copies` row.
- Version timeline badges (*On this computer* / *In the cloud* / *On another
  computer*) and the "waiting for a desktop copy" explanation state.

Acceptance: upload a third bounce to a track with a confirmed local copy of
version one — version one evicts from the cloud, stays fully visible in the
history, badge updates correctly. Repeat with **no** confirmed local copy
anywhere for version one — it stays in the cloud past the cap, with the
explanation shown.

### Package 4 — Offline read

- IndexedDB store per entity, persister attached to the existing
  `QueryClient` (`components/providers.tsx`), scoped to Board, Tracks,
  Projects, Tasks, Calendar only.
- Offline banner, "needs a connection" state for the five online-only
  surfaces.

Acceptance: disconnect network, the five surfaces show last-synced data with
the offline banner; the five online-only surfaces show the plain blocked
state instead of erroring.

### Package 5 — Offline write, outbox, conflicts

- Durable outbox, optimistic local updates, ordered replay on reconnect.
- Conflict detection via `updated_at` comparison at replay time, and the
  conflict-resolution UI from the product spec.

Acceptance: make an edit offline, reconnect, confirm it lands; make the same
field's edit from the web while offline on desktop, reconnect, confirm the
conflict is surfaced rather than silently overwritten in either direction.

## Migration gate

Per `.cursorrules`: schema changes are additive, numbered, and handed to the
user to run manually — never applied automatically by a coding agent. Package
3 is the only package touching schema. Its migration is written, explained in
plain terms, and the work **stops for confirmation that it's been run**
before package 3's application code (which depends on the new columns/tables)
is considered mergeable.

## Test matrix

- **Vitest (unit):**
  - Vault index operations (write, checksum, orphan sweep).
  - `selectVersionsToPrune`'s new two-phase logic — unbounded retention,
    two-in-the-cloud cap, the confirmed-local-copy precondition, including the
    "no copy anywhere" case that must *not* evict.
  - Outbox replay ordering and the `updated_at` conflict comparison.
- **Playwright (e2e):**
  - Download button's three states, driven by a mocked device-registration
    state rather than actual browser sniffing.
  - Offline banner and the five-surface / five-surface split (existing
    Playwright fixtures for Board/Tracks/etc. gain an offline-mode run).
- **Manual matrix** (both OSes each time): fresh install, unsigned-install
  warning flow, sign-in (password + OAuth), close-to-tray behavior,
  launch-at-login after a real restart, auto-update from the previous build,
  vault relocation, disk-full simulation, pulling a network cable mid-sync.

## Build and release

- `electron-builder` for packaging both installers from one config.
- GitHub Releases as the auto-update feed (Electron's built-in updater
  points at it) — avoids standing up a separate update server for a beta-stage
  program.
- Desktop app version is tracked separately from `lib/version.ts`'s
  `APP_VERSION` (the web app's version) — they version independently since
  they ship on different cadences, but the desktop app records its own
  version in `user_devices.app_version` (§4 of the technical doc) so a
  too-old desktop client can be detected and prompted to update rather than
  silently sending requests the current schema doesn't expect.
- The existing pre-push hook (`.claude/hooks/check-release-rules.sh`) governs
  the web app's `CHANGELOG.md`/version rules unchanged; desktop-only commits
  that don't touch the web app's user-facing behavior use the same
  `[skip-release-check]` marker convention already documented in `CLAUDE.md`
  where appropriate, but any change to shared surfaces (the download button
  itself, the version-history badges) still goes through the normal
  CHANGELOG/PRODUCT.md/version-bump obligations since those are web-app-visible.

## Rollout

1. **Internal build** — sign-in restricted to the developer's own account,
   both OSes, full manual matrix above.
2. **Invited beta** — download button visible only to a small allow-listed
   set of accounts (a flag, not a public toggle), unsigned-install warnings
   accepted as a known beta cost per the binding decision.
3. **General availability of the download button** — once packages 1–3 have
   run in the beta group without a vault-integrity or eviction-safety issue,
   and packages 4–5 have had their own separate soak if offline write has
   shipped by then. Signing (Apple notarization, Windows code-signing) is
   revisited before this step, not after.

**Rollback triggers:** any report of a bounce that was evicted from the cloud
with no recoverable local copy anywhere (a violation of the core safety
guarantee) is a stop-ship / immediate-disable-of-cloud-eviction event, not a
"fix in the next release" one — cloud eviction can be disabled via the same
flag pattern as the beta rollout without disabling the rest of the desktop
app.

## Acceptance criteria, program-level

- A brand-new bounce upload on desktop is playable offline immediately after
  upload.
- No bounce is ever evicted from the cloud without a confirmed local copy
  recorded somewhere for it.
- The five bounded surfaces are fully usable (read and write, once package 5
  ships) with the network disabled.
- The five online-only surfaces never show stale data while offline — only
  the explicit blocked state.
- Reopening TEMPO after being closed-to-tray for a day shows a workspace
  that's already current, with no visible "catching up" delay for anything
  that changed while it was in the background.
