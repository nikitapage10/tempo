# TEMPO — Musician Project Management Tool
## Design & Architecture Specification v1.0

*Working codename: **TEMPO** (rename freely). This document is the master handoff spec: product vision, MVP scope, roadmap, data model, tech architecture, visual design language, and screen-by-screen specs. It is written to be handed section-by-section to a coding model.*

---

# 1. Product Vision

TEMPO is a single-user (for now) workspace that manages **the entire life of a musician's output** — not just the audio production of a track. The competitor product (analyzed below) is a production Kanban board. TEMPO's core insight is broader:

> A "project" for a working artist is not just a tune moving from idea to master. It's the tune **plus** the pitching, the social content, the remix requests, the edit packs, the release assets, and the follow-ups. The tool should hold all of it, connected.

Three object types make this work:

1. **Tracks** — a musical work (original, remix, edit, bootleg, collab) with metadata, a stage in a workflow, versions, stems, and notes.
2. **Projects** — a work container you define (a campaign, a release push, related tasks and tracks, whatever the goal is). Many tracks and tasks can attach to one project; a track can stand alone with no project. Not a one-track wrapper. (Album/EP/playlist-style buckets on the Tracks list are a separate “groups” concept.)
3. **Tasks** — anything actionable, attachable to a track, a project, or nothing ("post teaser clip," "email X a remix," "pitch 'Song' to Label Y"). Tasks have their own lightweight workflow independent of track stages.

This three-object model is what makes TEMPO "all-encompassing musician workflow" rather than a production tracker clone.

## Design principles

- **Versions are first-class.** Every bounce you upload becomes an immutable version with a date, notes, and a waveform. Nothing gets overwritten. This is the single biggest fix over the competitor.
- **Progress is honest.** Checklist percentage is shown, but the primary status signal is the stage + a manual "momentum" indicator (Active / Simmering / Stalled / Parked), because a checkbox count lies about creative work.
- **Low ceremony.** The competitor's biggest weakness is setup burden. TEMPO ships with sensible defaults (default workflow, default checklist templates) and lets you customize later. Creating a track should take under 10 seconds.
- **The library is the source of truth.** Audio lives in the app's storage (cloud object storage), not as fragile links to files on one machine.

---

# 2. Competitor Teardown (from the attached PDF)

## Keep (their good ideas, adopted into TEMPO)
- Track cards with stage, completion %, BPM, key, destination, deadline, tags
- Customizable stage workflow (rename/reorder/add/remove)
- Multiple workspaces ("scenes") — TEMPO calls these **Spaces** (e.g., "Originals," "Client Work," "Edits & Remixes")
- Per-track checklist + reusable checklist templates
- Timestamped notes pinned to playback position ("1:24 — vocal too loud")
- Feedback log with reviewer, status, related version
- Analytics: stall detection, time-in-stage, started vs. finished

## Fix (their documented weaknesses, and TEMPO's answer)

| Weakness | TEMPO's answer |
|---|---|
| macOS-only, no mobile/web | Web app (responsive, PWA-installable) from day one |
| Fragile local file links | Real uploads to cloud object storage; files travel with the project |
| Manual backup / migration | Cloud-persisted; nothing to back up manually |
| No version management | Immutable version history per track (MVP feature) |
| Misleading checklist % | Momentum indicator + stage as primary signals; % is secondary |
| No collaboration | Deferred to v2 (share links, comments) — schema designed for it now |
| No workflow intelligence | v1.5: "Next action" nudges, stall alerts |
| High setup burden | Default templates, instant track creation, optional customization |

## Deliberately NOT copying
- Native macOS app / DAW-folder watching (their companion-app model). Out of scope until much later; the web-first architecture matters more to you (access from anywhere, phone uploads of voice memos).

---

# 3. MVP Scope & Roadmap

## v0.1 — MVP ("can replace my spreadsheet/notes today")

**Spaces & Board**
- Spaces (workspaces): create, rename, switch. Ships with two defaults: "Originals" and "Edits & Remixes."
- Kanban board per space with default stages: Idea → Writing → Production → Mixdown → Master → Release Prep → Released. Stages are editable (add/rename/reorder/delete) per space.
- Track cards: title, artwork thumb (optional), stage, type badge (Original / Remix / Edit / Collab / Bootleg), BPM, key, momentum dot, deadline if set.
- Drag-and-drop between stages.

**Track workspace (detail page)**
- Metadata: title, artist/alias, type, BPM, key, genre, target destination (label/self-release/pack), deadline, tags, notes.
- **Versions:** upload audio (mp3/wav/aiff/m4a), each upload = new version with auto-number, name, date, "what changed" note. Inline streaming player with waveform. Mark one version as "current."
- **Stems & assets:** upload vocal stems, MIDI, project bounces, artwork, lyrics files. Simple file list grouped by type.
- **Checklist:** per-track tasks with done state; apply a template; % completion derived from it.
- **Session log:** a dated log entry ("worked on drums, rewrote drop") — one tap to start an entry, optionally auto-linked to the version you uploaded that day. This is your session tracker.

**Tasks (global)**
- A task list outside of tracks: title, due date, status (Todo/Doing/Done), optional link to a track or project, category chip (Social, Outreach, Pitching, Admin, Production).
- "Today" view: tasks due/overdue + tracks marked Active.

**Projects (containers)**
- Create a project (e.g., "Edit Pack Vol. 2"), attach tracks and tasks to it, see combined progress. MVP keeps this thin: name, description, deadline, list of member tracks/tasks.

**Templates**
- Ship with 4 built-in checklist templates (Arrangement, Mixdown, Master Prep, Release Prep). User can save any checklist as a template.

## v0.5 — Quality of life
- Timestamped playback comments on versions (the "1:24 vocal too loud" feature)
- Feedback log (external feedback entries tied to versions, with resolved state)
- Audio preview generation (server-side mp3 preview of wav uploads for fast streaming)
- Global search; filters on board (by type, tag, key, BPM range)
- Custom accent theming per space

## v1.0 — Intelligence & analytics
- Dashboard analytics: started vs. finished, time-in-stage, stall detection ("no activity in 21 days — resume, simplify, or park?")
- "Next action" suggestions per track
- Release packages: deliverables checklist per release (master, instrumental, radio edit, stems, artwork, metadata, ISRC…) with ready/not-ready state

## v2.0 — Collaboration
- Shareable review links (stream current version + leave timestamped comments, no account needed)
- Roles/permissions, activity timeline, approvals

The MVP is genuinely buildable by a cheaper coding model in a few sessions if the schema and screens below are followed exactly.

---

# 4. Architecture & Stack

## Why not GitHub for audio

You floated GitHub for storing tunes. Recommendation: **no** — Git is designed for diffable text. Audio binaries mean: 100 MB hard file limit (a 24-bit wav of a full track exceeds this constantly), Git LFS costs and quota pain, no streaming (you'd download whole files to preview), no waveforms, and every clone drags the full history of every bounce. GitHub is the right home for the app's *source code*, not the music.

What you actually want from "GitHub for tunes" is **versioning semantics** — immutable history, named revisions, notes per revision. TEMPO gives you that at the app level (the `versions` table) on top of plain object storage, which is the correct pattern.

## Recommended stack (optimized for cheap-model codability)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript** | Massive training data footprint — cheaper models make far fewer mistakes here than on exotic stacks |
| UI | **Tailwind CSS + shadcn/ui** | Matches the component you found; shadcn gives accessible primitives the model can compose |
| Backend/DB | **Supabase** (Postgres + Auth + Storage) | One vendor covers DB, auth, and object storage with signed URLs; generous free tier; extremely well-documented so cheap models handle it well |
| Audio player | **wavesurfer.js** | Waveform rendering + timestamped regions/markers (needed in v0.5) out of the box |
| Drag & drop | **@dnd-kit** | Standard, well-known Kanban DnD |
| State | React Query (TanStack) over Supabase client | Simple cache/invalidation; avoid Redux |
| Deploy | Vercel (app) + Supabase cloud | Zero-ops |

Alternative considered and rejected for MVP: local-first (SQLite/Tauri). It recreates the competitor's worst weaknesses (single device, manual backup) and is harder for cheap models to scaffold.

**Storage note:** Supabase Storage free tier is 1 GB — fine for MVP testing, tight for wavs. When you outgrow it, either pay Supabase or point uploads at **Cloudflare R2** (zero egress fees, ideal for streaming audio) while keeping Supabase for DB/auth. Design the upload path behind one small module (`lib/storage.ts`) so swapping providers is a one-file change.

## Data model (Postgres)

```
spaces        id, name, sort, accent_color, created_at
stages        id, space_id, name, sort, color
projects      id, space_id?, name, description, deadline, status, created_at
tracks        id, space_id, project_id?, stage_id, title, artist_alias,
              type ('original'|'remix'|'edit'|'collab'|'bootleg'),
              bpm, musical_key, genre, destination, deadline,
              momentum ('active'|'simmering'|'stalled'|'parked'),
              tags text[], notes, artwork_url, created_at, updated_at
versions      id, track_id, version_no, label, changelog, file_url,
              file_size, duration, is_current bool, created_at
assets        id, track_id, kind ('stem'|'midi'|'artwork'|'lyrics'|'reference'|'other'),
              name, file_url, file_size, created_at
checklist_items  id, track_id, text, done bool, sort, created_at
templates     id, name, items jsonb   -- [{text, sort}]
tasks         id, track_id?, project_id?, title, category
              ('social'|'outreach'|'pitching'|'admin'|'production'|'other'),
              status ('todo'|'doing'|'done'), due_date, notes, created_at
sessions      id, track_id, note, version_id?, logged_at
-- v0.5+:
comments      id, version_id, timestamp_sec, text, resolved bool, created_at
feedback      id, track_id, version_id?, reviewer, text, status, received_at
```

Rules the coding model must follow:
- Versions are **append-only**: no UPDATE of `file_url`, no DELETE except explicit user action with confirm.
- `version_no` auto-increments per track (max+1 in a transaction or a Postgres trigger).
- Completion % is computed, never stored: `done items / total items`.
- All files upload to bucket paths `tracks/{track_id}/versions/{version_id}/{filename}` and `tracks/{track_id}/assets/{asset_id}/{filename}`; DB stores the path; playback uses signed URLs (1-hour expiry).
- Single-user auth for MVP (email magic link via Supabase Auth), but every table already carries ownership via space → user, so multi-user later is additive, not a rewrite.

---

# 5. Visual Design Language — "Spectra"

The shader-lines reference is the seed of the whole identity: **thin vertical bands of prismatic light — ice blue, warm white, amber — bleeding through black**, like lens flare through a slit, or LEDs behind a fog machine. It reads as *stage lighting meets spectrum analyzer*, which is exactly right for a musician's tool. The design language is built around that image, but disciplined so the UI stays readable.

## The golden rule for the shader

You already spotted the problem: full-bleed animated shader behind white text and dense project data is unreadable and battery-hungry. So the shader is **an atmosphere, never a background for content.** It appears in exactly four places:

1. **Boot/intro moment** — on app load, the shader plays full-bleed for ~1.2s behind the wordmark, then the lines "collapse" (scale-Y down toward the horizontal center) into a thin light strip that becomes the top edge of the app chrome. One orchestrated moment, then it gets out of the way. Respect `prefers-reduced-motion`: skip straight to the app.
2. **Edge glow strips** — a 2–4px animated strip along the top of the viewport (and optionally the left rail), rendered from the same shader cropped tall-and-thin. Subtle, ~40% opacity, GPU-cheap.
3. **Empty states** — an empty board/space shows a contained shader panel (rounded card, ~300px tall) with the invitation copy on a solid scrim, not directly on the shader.
4. **Hero of the "Today" dashboard** — a short, contained banner (~120px) behind the greeting/date, with a black→transparent gradient scrim ensuring text sits on ≥ 85% black.

Everywhere else, the shader's *palette* carries the theme through static CSS gradients and glows — no WebGL cost. A reusable `.flare-line` element (1px gradient line: transparent → ice → white → amber → transparent) is the signature motif, used as section dividers, active-stage underlines, and the "current version" indicator.

**Performance guardrails for the coding model:** one WebGL context max; pause `requestAnimationFrame` when the tab is hidden or element scrolled out; cap `devicePixelRatio` at 2; provide a static gradient PNG fallback; kill the shader entirely on `prefers-reduced-motion`.

## Color tokens

Near-black, never pure black, so the flare colors have depth to glow against.

```
--bg-0:      #0A0A0C   /* app background */
--bg-1:      #121216   /* cards, rails */
--bg-2:      #1A1A21   /* raised surfaces, inputs */
--line:      #26262E   /* hairline borders */
--text-hi:   #F2F0EB   /* warm white — primary text */
--text-lo:   #8B8B96   /* secondary text */
--ice:       #7FB4FF   /* flare blue — interactive accent, links, focus */
--amber:     #FFB56B   /* flare amber — warmth, highlights, "current" markers */
--violet:    #9D8CFF   /* rare tertiary, analytics only */
--ok:        #6FD99A   /* done states */
--warn:      #FF7A6B   /* overdue, stalled */
```

Accent usage rule: **ice is the hand (interaction), amber is the light (status/emphasis).** Buttons, links, focus rings = ice. "Current version," momentum-active dots, the flare-line motif's warm center = amber. Never use both as competing CTAs on one surface. Per-space accent theming (v0.5) recolors only `--ice`.

Semantic chips: track types get muted translucent chips (e.g., Original = ice at 12% alpha bg / ice text; Remix = amber; Edit = violet; Collab = green) — colored text on tinted dark, never solid bright fills.

## Typography

- **Display / wordmark / stage headers:** `Space Grotesk` (600/700). Geometric, slightly technical, tracks tight (-0.02em) — it echoes the precision of the shader lines without being a sci-fi cliché.
- **Body / UI:** `Inter` (400/500) at 14px base, 1.5 line height.
- **Data face:** `JetBrains Mono` (400/500) for BPM, keys, timestamps, version numbers, durations — *all musical/technical data is set in mono.* This is a signature decision: "124 BPM · F♯m · v7 · 3:42" in amber-tinted mono instantly reads as "studio instrument," and it keeps tabular data aligned.

Type scale: 28/20/16/14/12. Sentence case everywhere except tiny mono eyebrow labels (11px, +0.08em tracking, `--text-lo`) used for section labels like `VERSIONS`, `STEMS`, `SESSION LOG`.

## Surfaces, shape, motion

- Radius: 10px cards, 8px inputs/buttons, 999px chips. Borders are 1px `--line`; elevation is expressed by background step (bg-1 → bg-2) + a faint 0 8px 24px black shadow, not bright outlines.
- Waveforms render in `--text-lo` with the played portion in a ice→amber gradient — the player itself becomes a brand moment.
- Motion: 150ms ease-out for hover/press; 250ms for drawers and card drops. Card drag shows a 1px ice glow. The only "showy" motions are the intro collapse and a subtle 6s shimmer drift on `.flare-line` elements. Everything else is quiet.
- Focus states: 2px ice ring, always visible on keyboard nav.

## Voice

Plain, studio-casual, active verbs. "Upload a bounce," "Log a session," "Mark as current," "Park this track." Empty states invite: "No tracks in Mixdown. Drag one in, or start something new." Errors say what happened and what to do: "Upload failed — file is over 200 MB. Bounce a smaller format or compress the wav."

---

# 6. Screen Specs (MVP)

## Layout shell
Left rail (220px, `--bg-1`): wordmark + flare-line under it; Space switcher; nav (Today, Board, Tracks, Projects, Tasks); bottom: settings. Top of viewport: 2px shader/gradient edge strip. Content area max-width 1440px. Mobile: rail collapses to bottom tab bar (Today / Board / Tasks / +).

## 1. Today (default landing)
- Contained shader hero (~120px): greeting, date, and three mono stats: `ACTIVE TRACKS 6 · DUE THIS WEEK 3 · SESSIONS THIS WEEK 4`.
- Two columns: **Tasks due** (checkbox list with category chips, overdue in `--warn`) and **In motion** (tracks with momentum = Active, as compact rows: artwork thumb, title, stage, last-session date).
- Quick actions row: `+ Track` `+ Task` `Log session`.

## 2. Board (per space)
- Header: space name, stage-editor button, filter chips (type/tag), `+ Track`.
- Horizontal-scroll Kanban. Column header: stage name + mono count; the active-drag column gets a flare-line underline.
- Card (as specified in §3): tap → track workspace; drag between stages persists immediately (optimistic update).

## 3. Track workspace
Header band: artwork (or gradient placeholder derived from track id), title (editable inline), mono meta line `124 BPM · F♯m · v7 · Edit`, momentum selector, stage dropdown, deadline. Below, two-column layout (stack on mobile):

**Left (2/3):**
- **Player** — current version, wavesurfer waveform, transport, version dropdown to A/B older versions.
- **Versions** — list, newest first: `v7` (mono, amber if current) · label · changelog · date · size · [set current] [download]. Top: drop-zone/`Upload new version` with a one-line "what changed?" field.
- **Session log** — reverse-chron entries; `Log session` opens a one-field composer, auto-links today's upload if one exists.

**Right (1/3):**
- **Checklist** — items + progress bar (thin, ice→amber fill), `Apply template ▾`, `Save as template`.
- **Stems & assets** — grouped by kind, drop-zone upload.
- **Notes** — freeform markdown-lite.
- **Details** — the remaining metadata fields.

## 4. Tasks
- Filterable list (category, status, linked track/project), grouped: Overdue / Today / This week / Later. Inline add at top. A task linked to a track shows the track as a small chip → deep link.

## 5. Projects
- Card grid: name, deadline, member counts, aggregate checklist %. Detail page: description + attached tracks (compact rows) + attached tasks. `Edit Pack Vol. 2` is the canonical test case: a project holding 8 edit-type tracks and tasks like "master all," "make cover art," "write email blast."

## 6. Settings / Space editor
- Manage spaces (name, accent — v0.5), stage editor (add/rename/reorder/delete with "move tracks to…" on delete), templates manager, account.

---

# 7. Build Order for the Coding Model

Hand these as sequential work packages; each ends runnable.

1. **Scaffold:** Next.js + TS + Tailwind + shadcn init; design tokens from §5 as CSS variables + Tailwind config; app shell (rail, edge strip as static gradient first); Supabase project + schema migration from §4; magic-link auth.
2. **Spaces & Board:** spaces CRUD + seed defaults; stages CRUD; tracks CRUD (create modal: title + type only, everything else optional); Kanban with dnd-kit; track cards.
3. **Track workspace:** detail page layout; metadata editing; checklist + templates; notes.
4. **Audio:** storage module (`lib/storage.ts`); version upload flow (append-only, auto-numbering); wavesurfer player with signed URLs; assets/stems upload; session log.
5. **Tasks & Projects & Today:** tasks CRUD + views; thin projects; Today dashboard.
6. **Polish pass:** shader component (adapt the provided `shader-lines.tsx` — but load `three` from npm, not a CDN script tag, and swap deprecated `PlaneBufferGeometry`/`Camera` for `PlaneGeometry`/`OrthographicCamera` since modern three removed them); intro moment; empty states; mobile layout; reduced-motion fallbacks.

Prompting tips for cheap models: give one package at a time with the relevant spec sections pasted in; demand TypeScript strict and no new dependencies beyond the stack table; after each package, have it write a manual test checklist you click through before moving on.

---

# 8. Open Decisions (your call, none block the build)

1. **Name** — TEMPO is a placeholder; the wordmark treatment in §5 works for anything short.
2. **Wav policy** — store original wavs (safe, big) vs. transcode-to-mp3-only for MVP (cheap, lossy). Recommendation: store originals, add server-side mp3 previews in v0.5.
3. **Momentum** — manual selector (MVP) vs. auto-derived from session/upload recency (v1). Recommendation: manual now, auto-suggest later.
4. **Mobile uploads** — the PWA handles voice-memo uploads from your phone into a track's assets; worth testing early since it was the competitor's most-cited gap.
