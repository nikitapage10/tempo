# TEMPO Desktop — technical and data design

Architecture, schema blueprint, sync design, and failure handling for TEMPO
Desktop. No runnable SQL — schema changes are described here and turned into
a numbered migration file during implementation, per `.cursorrules`.

## 1. Why this isn't a browser wrapper, and why it also isn't a second server

The app is a **thin native shell around a set of surfaces the renderer already
knows how to draw**, with three things pulled onto the local machine that
today are always fetched: the app bundle itself, the media files, and (for
five surfaces) the catalog data.

It is explicitly **not** a bundled copy of the Next.js server. TEMPO has 64
route handlers under `app/api/`, several of which run with the Supabase
**service-role key** (`lib/supabase/admin.ts`) — a full RLS bypass — plus
`OPENAI_API_KEY`, `CRON_SECRET`, and mail provider credentials. Shipping that
server inside a desktop installer would ship those secrets to every artist's
disk, recoverable by anyone with the installer. So:

| Layer | Runs | Notes |
|---|---|---|
| Renderer UI (React, shaders, wavesurfer, ffmpeg.wasm) | **Locally**, precached | Same code the web app ships; no server rendering needed for the parts that go local. |
| Media (artwork, bounces) | **Locally**, mirrored | The vault (§3). |
| Catalog data (tracks, tasks, projects, calendar, board) | **Locally**, cached + outbox | IndexedDB (§6). |
| Routes needing secrets (assistant, admin, email/invite, cron, webhooks) | **Vercel**, called over HTTPS | Unchanged. Desktop app is a client of these, same as the browser is today. |
| Auth, Postgres | **Supabase, cloud** | Unchanged, single source of truth, multi-device. |

## 2. Process architecture

Electron, chosen over Tauri specifically because TEMPO leans hard on Chromium
behaviors (WebGL shaders via `three`, `wavesurfer.js`, `ffmpeg.wasm` audio
transcode) that would otherwise need re-validating against WebView2 (Windows)
and WKWebView (Mac) as two additional rendering engines. Pinning Chromium via
Electron keeps the surface identical to what's already tested in the browser.
This is a new dependency, flagged per `.cursorrules`' "no new dependencies
without asking" — the README's binding decisions are that ask.

- **Main process** — window lifecycle, tray, auto-update, the local vault and
  its index, the sync scheduler, and the IndexedDB-backed offline outbox's
  network-facing half. Holds no Supabase service-role or other server secret;
  it authenticates as the signed-in artist, same as the browser does.
- **Preload script** — a narrow, explicitly-typed bridge
  (`window.tempoDesktop`) exposing only what the renderer needs: vault
  read/write, sync status, device registration, tray/login-item settings.
  `contextIsolation: true`, `nodeIntegration: false`, no `remote` module.
- **Renderer** — loads the production origin over HTTPS
  (`mytempo.dev`), not a `file://` bundle of the whole app;
  navigation is allowlisted to that origin plus the auth/OAuth redirect
  targets, so the renderer can't be pointed elsewhere. What makes this "not a
  wrapper" is that most of what the renderer needs — the shell's static
  assets, artwork, and bounce audio — resolve from the local vault before they
  ever try the network (§3), so a normal session simply doesn't hit the wire
  for those.

## 3. The local vault, and the seam that makes it fit

The whole app already funnels every storage read and write through one
module: `lib/storage.ts`. That module's own header comment says the provider
is meant to be swappable ("Supabase Storage → R2, etc."). Desktop resolution
is a second provider, not a rewrite:

- **Reads** — `getSignedUrl(path)` already passes absolute URLs straight
  through unchanged (`lib/storage.ts:250-263`, the same early-return that lets
  `http(s)://`, `data:`, and `blob:` paths skip signing). On desktop, this
  becomes: local vault hit → resolve to a custom-protocol URL
  (`tempo-local://…`) served from the vault by the main process; vault miss →
  existing signed-URL path exactly as today, with the fetched bytes then
  mirrored to the vault in the background for next time. Every consumer —
  `wavesurfer.js` in the version player, the global mini-player, blind A/B,
  every `SignedImage` — needs **no changes**, because they only ever consume
  the string `getSignedUrl` returns.
- **Writes** — `uploadFile(path, file)` gets a desktop-only first step: write
  to the vault, record the local copy, *then* proceed with the existing
  Supabase Storage upload. If the network step fails, the vault copy still
  exists and the upload is retried by the sync scheduler rather than lost.

### Vault layout on disk

Mirrors the existing storage path convention exactly, so the mapping between
a cloud object and its local copy is a pure string operation, not a lookup
table:

```
<vault-root>/
  tracks/{trackId}/versions/{versionId}/{filename}
  tracks/{trackId}/assets/{assetId}/{filename}
  artists/{artistId}/{logo|emblem|banner}/{filename}
  index.sqlite      -- local copy of "what do I have and its checksum"
```

The index (SQLite, one file, no server) tracks path, checksum, byte size, and
last-verified timestamp per local file, and is what the Storage screen reads
to show vault size and what a "re-download" button acts on. Orphan
reclamation (a local file whose cloud row no longer exists — track deleted,
bounce manually removed) is a periodic sweep against the index, not a
per-action check.

### Upload flow, rewritten

`lib/api/versions.ts`'s `uploadVersion` keeps its existing steps
(`assertAudioFile` → optional wav/aiff→mp3 via `lib/audio-convert.ts` →
`crypto.randomUUID()` versionId generated client-side → insert `versions` row
→ compensating delete on DB failure) and gains one, on desktop only, between
transcode and cloud upload: **write to vault, record the local copy.** The
cloud upload and DB insert happen exactly as they do today; the difference is
that a network failure after this point no longer loses the artist's bounce —
it's already on disk, and retried.

## 4. Schema blueprint (additive only — next migration is `080`)

Latest migration on disk is `079_delete_own_social_post.sql`. Everything below
is described in shape, not written as runnable SQL — implementation turns
this into `080_desktop_local_vault.sql` (name indicative) per the migration
gate in `.cursorrules` and `03-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md`.

### `versions` — two column changes, one column addition

Today (`schema.sql:95-107`): `file_url text NOT NULL`. Pruning
(`lib/version-prune.ts`) deletes the row and the storage object together once
a version falls out of the pinned+2-newest window — there is no state where a
version row exists without a live cloud object.

Desktop retention needs a version row to **outlive** its cloud object (bounce
is local-only, evicted from the cloud, still fully present in the artist's
history). So:

- `file_url` becomes **nullable** — null means "not currently in the cloud
  bucket," not "doesn't exist."
- Add `cloud_state text not null default 'in_cloud'` — `in_cloud` |
  `local_only`. Every consumer that currently assumes `file_url` is always
  resolvable (the version player, download button, blind A/B) branches on this
  new column when deciding whether to try `getSignedUrl` against the cloud or
  ask the desktop app's vault for a local copy instead — on the web, with no
  desktop app, `local_only` versions play only if the browser has network to
  fetch them isn't possible, so the web UI shows those versions as "on your
  computer only" rather than attempting playback.
- Add `evicted_at timestamptz null` — when the cloud copy was removed, shown
  in the version history badge tooltip.

### New table: `version_local_copies`

One row per (version, device) pair that has a confirmed local copy. This is
the enforcement mechanism for the safety amendment in the README: cloud
eviction is only allowed once at least one row exists here for the version
being evicted.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `version_id` | uuid FK → versions, cascade | |
| `device_id` | uuid FK → user_devices | |
| `checksum` | text | matches the vault index entry |
| `confirmed_at` | timestamptz | when the device told the server it has the bytes |

This table is also what powers the *On another computer* badge in the product
spec — a version with a `version_local_copies` row for a device that isn't
the current one, but none for the current device.

### New table: `user_devices`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `platform` | text | `windows` \| `mac` |
| `name` | text | e.g. "Nikita's MacBook Pro" |
| `app_version` | text | desktop app's own version, separate from `APP_VERSION` |
| `last_seen_at` | timestamptz | updated on each sync |
| `sync_enabled` | boolean | mirrors the background-sync setting, informational |

Registered on first sign-in from the desktop app; this is what drives the web
app's *Open in desktop* button state (a row exists and `last_seen_at` is
recent) instead of unreliable browser sniffing.

### RLS

Both new tables follow the existing collaborator-aware pattern in
`migrations/009_track_collaboration.sql` — a device or local-copy row is only
visible to/writable by the owning user, joined through the track's
`can_read_track` / `can_upload_track` helpers for `version_local_copies` so
collaborators' devices behave consistently with their existing track
permissions.

## 5. Retention rework

`lib/version-prune.ts`'s `selectVersionsToPrune` currently returns the set of
version **rows** to hard-delete (row + storage object together), keeping every
pinned version plus the two newest unpinned. It changes to a two-phase model:

1. **Row retention is unchanged and unbounded** — a version row is never
   deleted by this process; the artist's full history persists regardless of
   pin state. (Manual delete from the track page, with its existing strong
   confirm, is untouched — that's an explicit artist action, not automatic
   pruning.)
2. **Cloud eviction** replaces row deletion: after a successful upload, if a
   track has more than two versions with `cloud_state = 'in_cloud'`, the
   oldest excess ones are evicted — `file_url` cleared, `cloud_state` set to
   `local_only`, storage object removed — **but only for versions that already
   have at least one row in `version_local_copies`.** A version with no
   confirmed local copy anywhere (the artist has no desktop app, or hasn't
   finished its first sync) stays in the cloud past the cap rather than being
   silently lost — the version row's badge explains why ("Waiting for a
   desktop copy before removing this from the cloud").

This is a behavior change from today's pin-aware cap to an unconditional
two-in-the-cloud cap (per the binding decision), softened only by the
never-evict-without-a-confirmed-copy precondition — not by pin state.

## 6. Offline cache and outbox (Board, Tracks, Projects, Tasks, Calendar)

- **Read side:** an IndexedDB store per entity (tracks, tasks, projects,
  calendar events, board state), hydrated into the existing TanStack Query
  cache (`components/providers.tsx`'s `QueryClient`) as its persisted layer —
  React Query already sits between every one of these screens and Supabase, so
  this is a persister attached to infrastructure that exists, not a new data
  layer alongside it. Populated on each successful online fetch; read from
  when a query would otherwise fail offline.
- **Write side:** a durable **outbox** — each offline mutation (create task,
  move a board card, edit a project deadline, etc.) is appended to an ordered
  IndexedDB queue with enough payload to replay it, plus an optimistic update
  applied to the local cache immediately so the UI reflects it right away,
  matching TEMPO's existing optimistic-update convention for drag-and-drop and
  checkboxes. On reconnect, the main process replays the queue in order
  against the real mutation endpoints.
- **Conflict handling:** last-write-wins **per field**, guarded by comparing
  the mutation's captured `updated_at` against the server row's current
  `updated_at` at replay time. If they match, the write applies cleanly. If
  they don't — the record changed elsewhere since this device last saw it —
  the conflicting fields are surfaced in the UI (per the product spec) instead
  of overwritten silently. This is deliberately **not** a CRDT or an
  operational-transform layer: TEMPO's write patterns are field-level edits on
  single-owner-ish records (a track, a task), not concurrent free-text
  editing, so a CRDT would be solving a harder problem than the one that
  exists here.
- **Scope enforcement:** the outbox and offline cache are wired up only for
  the five bounded surfaces. Artist, Social, Scenes, Stats, and Messages
  deliberately get no offline cache — attempting to open them offline shows
  the plain "needs a connection" state from the product spec rather than
  stale or partial data.

## 7. Sync scheduler and tray/background residency

Ships in work package 1, ahead of the vault and offline cache, so it isn't
retrofitted onto an app only built to run in the foreground.

- `app.on('window-all-closed')` is a no-op instead of quitting when the
  background-sync setting is on; the window hides, the tray/menu-bar icon
  stays. An explicit **Quit TEMPO** in the tray menu is the only way to fully
  exit.
- `app.setLoginItemSettings` registers launch-at-login, so the tray-resident
  process comes back after a restart without the artist doing anything.
- A main-process interval sync (catalog delta pull, new-bounce/artwork
  mirroring into the vault, outbox flush when online) runs regardless of
  whether a renderer window is open, plus a subscription to the same Supabase
  Realtime channels the web app already uses for notifications and messages —
  so a push (someone else uploaded a bounce to a shared track) can trigger an
  immediate sync instead of waiting out the interval.
- Turning the setting off returns to conventional behavior: closing the
  window quits the process, and sync resumes fresh on next open.

**Deliberately out of scope:** syncing after the app has been fully quit (not
just closed to tray) requires an OS-level background agent independent of the
app process — `launchd` on macOS, a Scheduled Task or Windows Service on
Windows — installed, permissioned, and kept alive on its own. That's real
additional per-OS surface for a narrower need than "already synced when I open
it," and is called out in the README as an explicitly deferred v2 option
rather than folded into this program.

## 8. Auth on desktop

- Email/password sign-in works unchanged against the production origin —
  it's the same cookie-based Supabase SSR auth the web app uses
  (`middleware.ts` → `lib/supabase/middleware.ts`), and Electron's renderer is
  a normal Chromium context that handles cookies the same way a browser tab
  does.
- **OAuth (Google/Microsoft, `components/auth/oauth-buttons.tsx`) needs a
  redirect target Supabase can hand control back to** — a web `redirectTo` of
  `window.location.origin/auth/callback` doesn't resolve to anything inside an
  Electron shell. This needs either a loopback HTTP server the main process
  stands up temporarily during the OAuth flow, or a registered custom
  protocol (`tempo://auth/callback`) added as an allowed redirect URI in
  Supabase's auth settings. Flagged explicitly here because it's easy to defer
  past prototyping and then hit as a first-run blocker — needs deciding and
  configuring in Supabase before package 1 is considered done, not discovered
  during it.
- Device registration (`user_devices`, §4) happens immediately after a
  successful sign-in on desktop, before the first sync begins.

## 9. A pre-existing gap this program has to account for, not inherit

`schema.sql:317-323` gates storage objects on `owner = auth.uid()` for
select/insert/delete. `versions` row-level RLS is collaborator-aware
(`migrations/009_track_collaboration.sql`), but the **storage object policy is
not** — so today, a collaborator (editor/uploader/commenter/viewer added via a
track's People tab) can see a version row and still fail to get a signed URL
for its audio, because they don't own the object. This has already been
worked around per-feature for artwork
(`app/api/tracks/[id]/artwork-url/route.ts`), scene media
(`app/api/scenes/media/url/route.ts`), and message attachments — but **there
is no equivalent server route for version audio today.**

The vault design has to route a collaborator's bounce mirroring through a
signed-URL-issuing server route (following the existing artwork/scene-media
pattern) rather than assuming direct `getSignedUrl` access, or collaborators
on a shared track will be unable to sync that track's bounces into their own
vault. This is called out as a concrete task in
`03-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md` package 2, not left implicit.

## 10. Failure handling

| Failure | Behavior |
|---|---|
| Vault folder missing/renamed/unplugged drive | TEMPO detects on next vault access, tells the artist plainly, keeps working against the cloud in the meantime, offers to relocate or rebuild. |
| Disk full mid-write | Write aborts cleanly, no partial file left in the vault index, artist is told and the bounce stays cloud-only until there's room. |
| Checksum mismatch (local file corrupted/edited outside TEMPO) | Treated as a vault miss for that file; re-fetched from the cloud if still `in_cloud`, otherwise flagged for the artist to resolve (very rare — only possible if the version was already evicted and the only surviving copy got corrupted). |
| Two desktops both mirroring a not-yet-evicted version | No conflict — mirroring is additive (`version_local_copies` gets a row per device), not exclusive. |
| Clock skew between a desktop device and the server | Sync and conflict comparisons use the server's `updated_at`, not the device's local clock, for anything that decides ordering. |
| Desktop app older than the current schema/API shape | Sync scheduler checks a minimum-supported-version response on each sync attempt; below it, sync pauses with a clear "update TEMPO" prompt rather than sending malformed requests. |
