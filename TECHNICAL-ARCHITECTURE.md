# TEMPO — Technical Architecture

*Living document. Describes architecture as it exists today and intended boundaries for upcoming work packages. Prompt 0 — documentation only.*

---

## 1. What exists today

### Stack
- **Next.js 14+ App Router**, TypeScript strict, Tailwind + shadcn/ui primitives
- **Supabase**: Postgres, Auth (email + password), Storage bucket `audio` (private)
- **TanStack React Query** for client data fetching/caching/mutations
- **wavesurfer.js** for waveform playback
- **@dnd-kit** for Board Kanban drag-and-drop
- **three** only for Spectra shader moments (intro, top edge, empty states)

### App structure (high level)
| Area | Location pattern |
|------|------------------|
| Authenticated UI | `app/(app)/…` |
| Auth pages | `app/(auth)/login`, `app/(auth)/register`, `app/auth/…` |
| Browser Supabase | `lib/supabase/client.ts` |
| Server Supabase (cookie session) | `lib/supabase/server.ts` |
| Middleware session refresh + auth gate | `middleware.ts` → `lib/supabase/middleware.ts` |
| Domain APIs (client-callable) | `lib/api/*.ts` using browser Supabase + RLS |
| Storage abstraction | `lib/storage.ts` (signed URLs, private bucket) |
| Hooks | `hooks/use-*.ts` wrapping React Query |
| Track UI | `components/track/*` orchestrated by `app/(app)/track/[id]/page.tsx` |

### Data access today
- Almost all reads/writes go **browser → Supabase** with the **anon key** and the user’s JWT.
- **Row Level Security** enforces `user_id = auth.uid()` (or ownership via joins to `tracks` / `spaces`).
- There is **no service-role client** in the repo yet. That is intentional for the single-user phase.
- File playback uses **1-hour signed URLs** from `lib/storage.ts`. Paths are storage keys, not public URLs. Never `UPDATE file_url` on versions.

### Auth middleware today
- Unauthenticated users are redirected to `/login` except `/login`, `/register`, and `/auth/*`.
- Signed-in users hitting login/register redirect to `/`.
- Matcher excludes static assets, images, and ffmpeg.wasm paths.

### Track workspace today
- Page loads track, versions, stages; selects current (or first) version.
- Left: `VersionPlayer`, `VersionsPanel`, `SessionLog`.
- Right: checklist, assets, notes, details, delete.
- Version prune: keep latest **2** total (`MAX_VERSIONS_PER_TRACK`); will change when milestones ship.

---

## 2. Intended client / server boundaries

### A. Authenticated app data (default)
- **Preferred:** client modules in `lib/api/*` + RLS, same as today.
- React Query hooks own caching and optimistic updates.
- Use for: tracks, versions (owner path), checklist, sessions, tasks, projects, stages, spaces, templates, and future owner/collaborator reads that RLS can express cleanly.

### B. Public guest review (Prompt 4+)
- Routes: `/review/[token]` and `/api/review/*` only.
- **Must** validate tokens and issue signed audio URLs in **server-only route handlers**.
- Store **SHA-256(token)** only; never persist raw tokens; never log raw tokens.
- Guests do **not** receive a Supabase user session for the owner’s data.
- Use a **server-only admin client** (`lib/supabase/admin.ts`) with `SUPABASE_SERVICE_ROLE_KEY` for token lookup and controlled writes after validation.
- Responses: `Cache-Control: no-store`. Restrictive referrer policy. Generic errors to clients.

### C. Signed private audio
- Bucket `audio` stays **private forever**.
- Owner/collaborator playback: signed URLs via authenticated storage helpers (existing pattern).
- Guest playback: signed URLs created **only after** server validates an active (non-revoked, non-expired) link for that exact `version_id`.
- Never embed long-lived signed URLs in static HTML or CDN-cached page payloads.

### D. Future collaboration (Prompt 10)
- Prefer expressing access in **RLS + SECURITY DEFINER helper functions** (non-recursive).
- Invitation acceptance and hashed invite tokens follow the same server-validation pattern as guest links where client RLS alone is insufficient.
- Client UI hiding is convenience only — never security.

### E. Service-role key — hard rule
> `SUPABASE_SERVICE_ROLE_KEY` may only be imported and used in **server-only modules** and **Route Handlers / Server Actions**. It must never appear in `NEXT_PUBLIC_*` variables, client bundles, browser logs, or error messages returned to guests.

Add the key to `.env.local.example` and Vercel env docs when Prompt 4 lands. Guard `lib/supabase/admin.ts` with a runtime check that throws if imported in a client context (e.g. `typeof window !== "undefined"` or Next `server-only` package **only if dependency approved** — prefer a simple guard without new deps unless approved).

---

## 3. Public routes vs authenticated middleware

### Goal
Public review must work **without** a TEMPO account, without opening private app routes.

### Intended middleware allowlist
Extend `isAuthRoute` (or equivalent) so unauthenticated traffic may access **only**:
- `/login`, `/register`, `/auth/*` (existing)
- `/review` and `/review/[token]`
- Exact guest API paths under `/api/review/*`

Everything else under `app/(app)` remains auth-gated.

### Must not happen
- Broad `/api/*` public access
- Public Supabase anon policies that `select` arbitrary versions/tracks
- “Just make the bucket public for guests”
- Client passing arbitrary `version_id` that bypasses the link’s fixed version

### Defense in depth
1. Middleware allowlist (UX gate)
2. Server route token validation (authorization)
3. No broad anon RLS on private tables
4. Signed URL scoped to the linked object path only

---

## 4. React Query conventions

### Query key shapes (current + intended)
Use stable string roots; scope with ids; avoid anonymous objects as keys.

| Domain | Key | Notes |
|--------|-----|-------|
| Tracks in space | `["tracks", spaceId]` | Board / Tracks list |
| Track groups in space | `["track-groups", spaceId]` | Tracks page sections (migration 041) |
| Track list presets | `["track-list-presets", spaceId]` | Tracks saved Custom orders |
| Track detail | `["track", trackId]` | |
| Version count | `["version-count", trackId]` | |
| Versions | `["versions", trackId]` | |
| Checklist | `["checklist", trackId]` | |
| Assets | `["assets", trackId]` | |
| Sessions | `["sessions", trackId]` | |
| Stages | `["stages", spaceId]` | |
| Templates | `["templates"]` | |
| Tasks | `["tasks"]` | |
| Projects | `["projects"]`, `["project", id]` | |
| Today stats | `["today-stats"]` | |
| Comments (future) | `["comments", trackId, versionId \| "all"]` | |
| Guest links (future) | `["guest-links", trackId]` or `["guest-links", versionId]` | Owner only |
| Activity (future) | `["activity", trackId]` | Paginated cursor later |
| Notifications (future) | `["notifications"]` | |
| Workspace prefs (future) | `["workspace-prefs", trackId]` | Per user |
| Global search catalog | `["search-catalog", artistId]` | Artist-wide tracks/projects/tasks/notes/stages/people; client-side match |

### Invalidation expectations
- **Track patch** (stage, workflow, notes, meta): invalidate `["track", id]`, `["tracks", spaceId]`, and Today-related keys (`["today-stats"]`, future attention keys).
- **Versions**: invalidate versions + version-count + track; comments counts when present.
- **Checklist toggle**: optimistic on `["checklist", trackId]`; no need to refetch entire track.
- **Stage move (Board)**: optimistic tracks list; then recipe transition side-effects invalidate checklist/tasks/workflow as needed.
- **Comments resolve**: optimistic on comments key; invalidate attention/aggregates if used on Board/Today.
- Prefer **narrow invalidation** over `invalidateQueries()` with no key. Prefer updating cache from mutation results when the server returns the row.

### Optimistic UI policy
Safe: DnD stage moves, checklist toggles, resolve/reopen comments, workflow field patches with rollback.
Unsafe to invent server ids: creating comments, uploads, guest links, invites — wait for server response.

---

## 5. Storage architecture

```
tracks/{track_id}/versions/{version_id}/{filename}
tracks/{track_id}/assets/{asset_id}/{filename}
```

- All access through `lib/storage.ts` (and future server twin for guest signing if needed).
- Client upload uses session access token; progress XHR path exists for large files.
- Browser may convert wav/aiff → mp3 before upload (ffmpeg.wasm) to fit storage limits.

### Future pruning (Prompt 5)
Preserve: all `is_pinned` versions + two newest unpinned + never delete `is_current`. Delete storage objects for pruned rows after successful new upload. Document algorithm in DATA-MODEL.md / FEATURE-SPECS.

---

## 6. Route map (current + planned)

| Route | Auth | Purpose |
|-------|------|---------|
| `/`, `/today` | Yes | Today |
| `/board` | Yes | Kanban |
| `/tracks`, `/track/[id]` | Yes | Catalog + workspace |
| `/track/[id]/focus` | Yes | Focus session (planned) |
| `/tasks`, `/projects`, `/projects/[id]` | Yes | Tasks / projects |
| `/settings` | Yes | Spaces, sign-out, version. Team members see Account only. |
| `/artist` | Yes | Musician identity. Read-only when you have entered someone else's workspace. `/artist/[handle]` is the in-app network profile and is allowed from My work. |
| `/team` | Yes | Artist roster + invite by handle or email, or (in My work) a manager roster overview, pending team invites to approve, plus enter-workspace cards. `/artist/team` redirects here. |
| `/profile` | Yes | Signed-in person's name and photo. |
| `/login`, `/register` | Public | Auth. `/register` from a team/track invite token skips the platform invite code and locks the email to the invite. |
| `/review/[token]` | Public | Guest review (planned) |
| `/invite/[token]`, `/team-invite/[token]` | Public→Auth | Collaborator / team invite accept |
| `/api/review/*` | Public + server validation | Guest APIs (planned) |

---

## 7. Environment variables

| Variable | Client? | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Guest validation / privileged writes (planned) |

Production URL for shipped absolute links: `https://mytempo.dev`.

---

## 8. Versioning and docs coupling
Every work package bumps `package.json` + `lib/version.ts` identically, updates CHANGELOG.md and PRODUCT.md (PRODUCT.md only for features that actually ship), and keeps this file + FEATURE-SPECS / DATA-MODEL / DESIGN-SYSTEM-V2 / IMPLEMENTATION-PLAN / SECURITY / TESTING current when architecture decisions change.

---

## 9. Explicit non-architecture
- No Redux, Prisma, CSS-in-JS
- No new dependencies without asking
- No resetting the production database
- No email provider in the first notification system
