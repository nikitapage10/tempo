# TEMPO — Data Model

*Living document. Distinguishes **current** production schema from **proposed** additive schema. Never drop, truncate, or recreate production tables.*

Canonical full schema file: `schema.sql`  
Incremental changes: numbered files in `/migrations` (to be created starting with Prompt 2’s `001_track_workflow.sql`)

After each migration ships, update `schema.sql` to reflect the full desired state **and** keep the incremental migration file forever.

---

## Part A — Current schema (as of Prompt 0 / app v0.6.9)

### Ownership model today
Single-user. Almost every root row has `user_id` defaulting to `auth.uid()`, or is reachable only through a parent the user owns (`spaces` → `stages`, `tracks` → children).

### Tables

#### `artist_profiles` identity kind (migrations 028 + 098)

Artist and Pro accounts share the same handle, visibility, messaging, and social identity table. `profile_kind` is `artist` or `pro`, defaults to `artist`, and is mirrored from `artists.workspace_kind` (`personal` becomes `pro`). This keeps public and member profile reads self-contained: they can choose artist/release language or professional/career language without joining the private workspace table. The field changes presentation only and never grants artist access.

#### Dual artist + Pro identity (migrations 092 + 100)

An auth user may own both `artists.workspace_kind = 'artist'` and a separate
`workspace_kind = 'personal'` row. The former owns the musician's catalog,
Origin, and artist profile; the latter is the person's private Pro home and
professional profile. `artist_members` adds access to somebody else's artist
without changing either owned row. `legacy_complete` is a finished musician
state, not evidence of a placeholder. Migration 100 restores affected rows
that provably predate their first Pro/team acceptance and creates a personal
home if the repair leaves one missing; it moves or deletes no catalog data.

#### Pro tour preference (migration 099)

`member_onboarding.pro_tour_choice` stores the one-time professional guide
decision as `guides`, `skip_all`, or `null` before the choice is made. It is
deliberately separate from `main_tour_completed_at`, which belongs to the
artist's post-Origin introduction. This prevents dual accounts and account
switching from replaying or silently sharing tour decisions across identities.

#### `spaces`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid → auth.users CASCADE | owner |
| name | text | |
| sort | int | |
| accent_color | text null | |
| created_at | timestamptz | |

RLS: `user_id = auth.uid()`. Delete: cascades to stages; tracks reference space CASCADE.

#### `stages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| space_id | uuid → spaces CASCADE | |
| name | text | |
| sort | int | |
| color | text null | |
| created_at | timestamptz | |

RLS: via space ownership. Tracks.stage_id ON DELETE SET NULL.

#### `projects`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid → auth.users CASCADE | |
| space_id | uuid → spaces SET NULL | |
| name, description | text | |
| deadline | date null | |
| status | text | active\|done\|parked |
| created_at | timestamptz | |

#### `tracks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid → auth.users CASCADE | owner |
| space_id | uuid → spaces CASCADE | |
| project_id | uuid → projects SET NULL | Optional link to at most one project (many tracks may share a project; not 1:1) |
| stage_id | uuid → stages SET NULL | |
| title | text | |
| artist_alias | text null | |
| type | text | original\|remix\|edit |
| bpm | numeric(5,1) null | |
| musical_key, genre, destination | text null | |
| deadline | date null | |
| momentum | text | active\|simmering\|stalled\|parked |
| tags | text[] | default `{}` |
| notes | text null | |
| artwork_url | text null | storage path |
| list_sort | int | Tracks page custom order within a space (migration 017) |
| list_group_id | uuid → track_groups SET NULL | Tracks-page group (migration 041); not projects |
| created_at, updated_at | timestamptz | |

Indexes today: `idx_tracks_space`, `idx_tracks_stage`, `idx_tracks_space_list_sort`, `idx_tracks_space_list_group`.

#### `track_groups` (migration 041)
Named Tracks-page buckets (album, EP, playlist, etc.) — independent of `projects`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid → auth.users CASCADE | |
| space_id | uuid → spaces CASCADE | |
| name | text | 1–60 chars |
| sort | int | group order on Tracks |
| created_at, updated_at | timestamptz | |

RLS: `user_id = auth.uid()`. Delete sets `tracks.list_group_id` null.

#### `track_list_presets` (migration 018)
Named Tracks-page order snapshots per space.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid → auth.users CASCADE | |
| space_id | uuid → spaces CASCADE | |
| name | text | 1–60 chars |
| track_ids | uuid[] | ordered track ids |
| created_at, updated_at | timestamptz | |

RLS: `user_id = auth.uid()`.

#### `board_notes` (migration 020)
Sticky notes that live only on the Board (always assigned to a stage). Not tracks — never listed in Tracks / Today.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid → auth.users CASCADE | |
| space_id | uuid → spaces CASCADE | |
| stage_id | uuid → stages CASCADE | NOT NULL — notes always on a column |
| title | text | 1–120 chars |
| body | text null | optional details |
| sort | int | default 0 |
| created_at, updated_at | timestamptz | |

Index: `(space_id, stage_id, sort)`. RLS: `user_id = auth.uid()`.

#### `versions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| track_id | uuid → tracks CASCADE | |
| version_no | int | **set by trigger** — app must not set |
| label, changelog | text null | |
| file_url | text | storage path; **never UPDATE** |
| file_size | bigint null | |
| duration | numeric(7,2) null | |
| is_current | boolean | trigger clears siblings |
| created_at | timestamptz | |

Unique `(track_id, version_no)`. App keeps at most 2 versions (prune after upload).

#### `assets`
track_id CASCADE; kind stem\|midi\|artwork\|lyrics\|reference\|other; name; file_url; file_size; created_at.

#### `checklist_items`
track_id CASCADE; text; done; sort; created_at. Completion % computed in app, never stored.

#### `templates`
user_id; name; items jsonb `[{"text","sort"}]`.

#### `tasks`
user_id; optional track_id SET NULL / project_id SET NULL; title; category; status; due_date; notes.

#### `sessions`
track_id CASCADE; version_id SET NULL; note; logged_at. (Focus fields proposed later.)

#### `comments` (table exists; UI not shipped)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| version_id | uuid → versions CASCADE | |
| timestamp_sec | numeric(7,2) null | |
| text | text | |
| resolved | boolean | default false |
| created_at | timestamptz | |

RLS: via version → track ownership.

#### `feedback` (table exists; UI not shipped)
track_id; optional version_id; reviewer; text; status open\|resolved\|wont_fix; received_at.

### Storage
Private bucket `audio`. Object policies: owner = auth.uid() for select/insert/delete.

### Triggers (current)
- `set_version_no` BEFORE INSERT on versions
- `set_current_version` AFTER INSERT/UPDATE OF is_current

### Delete behavior (current)
Deleting a track cascades versions, assets, checklist, sessions, feedback; comments cascade via versions. Tasks/project links SET NULL.

### Retention (current)
Application prunes to 2 newest versions + storage delete. Manual version delete requires confirm.

---

## Part B — Proposed schema (additive only)

Migrations are ordered to match IMPLEMENTATION-PLAN.md. Column/table names below are the target design; exact SQL lives in migration files when those prompts run.

### Prompt 2 — `migrations/001_track_workflow.sql`

**Alter `tracks`:**
| Column | Type | Notes |
|--------|------|-------|
| next_action | text null | |
| next_action_due | date null | |
| blocked_reason | text null | |
| waiting_on | text null | |
| stage_entered_at | timestamptz NOT NULL DEFAULT now() | |

**Trigger:** update `stage_entered_at` **only when** `stage_id` actually changes (including non-client updates).

**Index (attention):** e.g. partial or composite useful for active tracks with next_action_due / blocked — exact index chosen in migration; candidate: `(user_id, momentum)` including due fields or `(next_action_due) WHERE momentum = 'active'`.

**Ownership/RLS:** unchanged (track owner).

---

### Prompt 3 — `migrations/002_timestamped_comments.sql`

**Preserve** existing `comments` rows.

**Alter `comments`:**
| Column | Type | Notes |
|--------|------|-------|
| track_id | uuid null→NOT NULL | backfill from versions |
| author_user_id | uuid null → auth.users SET NULL | |
| parent_id | uuid null → comments CASCADE | replies |
| assigned_to_user_id | uuid null → auth.users SET NULL | |
| resolved_at | timestamptz null | |
| resolved_by_user_id | uuid null → auth.users SET NULL | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |
| guest_link_id | uuid null | FK only if guest_review_links exists; else defer to Prompt 4 |

Keep `resolved` boolean; sync with `resolved_at` via trigger or app logic.

**Indexes:** (version_id, timestamp_sec); (track_id, resolved); parent_id; assigned_to_user_id.

**RLS:** rewrite so owners access comments for their tracks (via track_id). **No public policies yet.**

**Retention:** delete version → cascade comments. Confirm UI must show comment count.

---

### Prompt 4 — `migrations/003_guest_review_links.sql`

#### `guest_review_links`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| track_id | uuid NOT NULL → tracks | |
| version_id | uuid NOT NULL → versions | |
| created_by | uuid NOT NULL → auth.users | |
| token_hash | text UNIQUE NOT NULL | SHA-256 hex/bytes of raw token |
| label | text null | |
| expires_at | timestamptz null | default 14d in app |
| revoked_at | timestamptz null | |
| allow_comments | boolean NOT NULL DEFAULT true | |
| allow_download | boolean NOT NULL DEFAULT false | |
| created_at | timestamptz | |
| last_accessed_at | timestamptz null | |

**Indexes:** token_hash; (track_id); (version_id); active lookups `(token_hash) WHERE revoked_at IS NULL`.

**RLS:** owner-only manage. **No broad anon SELECT.** Server service-role validates tokens.

**Alter comments:** add `guest_name text null`, `guest_link_id` FK if missing.

**Retention:** revoke does not delete comments. Delete version blocked while active guest link targets it (app rule; optional DB constraint later).

---

### Prompt 5 — `migrations/004_version_milestones_and_decisions.sql`

**Alter `versions`:**
| Column | Type | Notes |
|--------|------|-------|
| is_pinned | boolean NOT NULL DEFAULT false | |
| milestone_type | text null | demo\|vocal_comp\|arrangement_lock\|mix_approved\|master\|custom |
| milestone_label | text null | |
| pinned_at | timestamptz null | |

#### `version_decisions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| track_id | uuid NOT NULL | |
| version_id | uuid NOT NULL | |
| decision_type | text | approved\|needs_changes\|rejected |
| decision_area | text | general\|arrangement\|vocal\|mix\|master\|release |
| note | text null | |
| created_by_user_id | uuid null | |
| guest_name | text null | future |
| guest_link_id | uuid null | future |
| created_at | timestamptz | |

Append-only. Owner RLS. Indexes on (track_id, created_at), (version_id).

**Pruning retention:** pinned forever (until unpinned); two newest unpinned; never prune current.

---

### Prompt 6 — `migrations/005_stage_recipes.sql`

#### `stage_recipes`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| stage_id | uuid UNIQUE NOT NULL → stages | |
| enabled | boolean DEFAULT true | |
| execution_mode | text DEFAULT 'preview' | preview\|automatic |
| actions | jsonb NOT NULL DEFAULT `[]` | validated in app |
| created_at, updated_at | timestamptz | |

#### `stage_recipe_runs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| recipe_id | uuid NOT NULL | |
| track_id, stage_id | uuid NOT NULL | |
| transition_key | text UNIQUE NOT NULL | idempotency |
| status | text | pending\|applied\|skipped\|partial\|failed |
| action_results | jsonb DEFAULT `[]` | |
| created_at, completed_at | timestamptz | |

RLS via stage → space ownership (later collaboration: recipe config owner-only).

**Action JSON (app-validated):** `{ "type": "...", ... }` for types listed in FEATURE-SPECS.

---

### Prompt 7 — `migrations/006_focus_sessions.sql`

**Alter `sessions`:**
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | backfill via track ownership → NOT NULL if safe |
| status | text NOT NULL DEFAULT 'completed' | active\|completed\|abandoned |
| goal, outcome | text null | |
| started_at, ended_at | timestamptz null | |
| elapsed_sec | int null | |
| next_action_after | text null | |
| created_at | timestamptz | if missing |

Preserve `note` + `logged_at` for old rows.

**Partial unique index:** one active session per user (`WHERE status = 'active'`).

---

### Prompt 8 — `migrations/007_track_references.sql`

#### `track_references`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| track_id | uuid NOT NULL → tracks CASCADE | |
| kind | text | audio\|image\|link\|note |
| title | text NOT NULL | |
| url | text null | links |
| asset_id | uuid null → assets SET NULL | |
| note | text null | |
| start_sec, end_sec | numeric null | audio region |
| intent | text null | |
| sort | int DEFAULT 0 | |
| created_at, updated_at | timestamptz | |

App constraints: audio/image prefer asset; link requires URL. Owner RLS.

---

### Prompt 9 — `migrations/008_release_workspace.sql`

**Alter `projects`:** `project_type text NOT NULL DEFAULT 'general'` — general\|single\|ep\|album\|edit_pack.

#### `release_details`
PK `project_id` → projects CASCADE; release_date; label_name; distributor; catalog_number; upc; pre_save_url; live_url; pitching_deadline; submitted_at; timezone; timestamps.

#### `release_track_metadata`
id; project_id; track_id; unique(project_id, track_id); track_number; version_title; isrc; explicit; primary_artist; featured_artists text[]; writers; producers; mix_engineer; mastering_engineer.

Owner RLS via project.

---

### Prompt 10 — `migrations/009_track_collaboration.sql`

#### `track_collaborators`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| track_id | uuid NOT NULL | |
| user_id | uuid null | set on accept |
| invited_email | text null | |
| role | text | editor\|uploader\|commenter\|viewer |
| status | text | pending\|active\|revoked |
| invited_by | uuid NOT NULL | |
| invite_token_hash | text null UNIQUE | |
| expires_at, accepted_at | timestamptz null | |
| created_at | timestamptz | |

Owner remains `tracks.user_id` — **not** duplicated as collaborator.

#### `activity_events`
id; track_id; actor_user_id null; actor_label null; event_type; entity_type null; entity_id null; summary; metadata jsonb; created_at.

#### `notifications`
id; user_id; track_id null; type; title; body; read_at null; created_at.

**Helper SQL** role-check functions to avoid recursive RLS.

**RLS updates** on tracks and children per SECURITY-AND-PERMISSIONS.md. Collaborators must **not** gain projects/tasks/spaces/other tracks by association.

---

### Prompt 11 — `migrations/010_workspace_preferences.sql`

#### `user_track_workspace_preferences`
id; user_id; track_id null; stage_id null; preset; module_order text[]; hidden_modules text[]; default_panel null; compact_mode boolean; updated_at.

Constraint/unique index matching precedence model (track-specific vs stage-specific vs global). Private per user — one user cannot alter another’s layout.

---

### Prompt 12 — optional `migrations/011_dashboard_aggregates.sql`

Only if Board/Today need aggregates (unresolved comment counts, etc.). Prefer views/RPCs; non-destructive; no table drops.

---

## Part C — Cross-cutting data rules

1. **Never** DROP/TRUNCATE/recreate tables in migrations.
2. Prefer nullable new columns + backfill + tighten NOT NULL when safe.
3. **Never** UPDATE `versions.file_url`.
4. `version_no` / `is_current` remain trigger-managed.
5. Completion % never stored on tracks.
6. Token columns store **hashes only**.
7. Guest and collaborator access validated server-side where RLS cannot see raw tokens.
8. Pinned versions exempt from normal two-unpinned retention.
9. Cascade deletes must be reflected in delete-confirmation copy (comments, decisions, guest links).

---

## Part D — Unresolved data decisions (non-blocking for Prompt 0)

| Topic | Options | Blocker? |
|-------|---------|----------|
| Exact attention index definition | Partial vs composite | No — choose in 001 |
| `resolved` bool vs only `resolved_at` | Dual sync vs deprecate later | No — keep both for compat |
| Guest link delete vs revoke-only | Soft revoke required | No |
| Collaborator access to `project_id` on track | Hide project chrome vs show name only | Decide in Prompt 10 plan gate |
| Workspace pref uniqueness | Track XOR stage XOR global rows | Decide in 010 |

None of these block creating the living docs or starting Prompt 1 (layout-only, no DB).

---

## Part E — Team Operations schema (migrations 101–105)

**Status:** Specification only. No tables or columns in this section should be treated as present until the corresponding migration ships.

The detailed schema and constraints live in `TEAM-OPERATIONS-TECHNICAL-DESIGN.md`. Proposed additive changes are grouped logically so implementation can choose the next available migration numbers safely:

1. **Permission contract:** extend the closed artist-team area vocabulary; add normalized effective-access and safe space-to-artist helpers.
2. **Membership lifecycle:** extend `artist_members`; add append-only `artist_membership_events`; add guarded suspend/resume/leave/end RPCs.
3. **Assignments:** add task assignee/assigner fields and `task_assignment_events`; add explicit `review_requests`; expose a secured My Work fan-in RPC.
4. **Team Brief:** add `artist_team_briefs`, links, source pins, and user-private seen state.
5. **Team room:** add a one-to-one `artist_team_rooms` binding over existing conversations plus safe work-link snapshots.
6. **Pro operations:** add user-owned availability and per-artist preferences plus a private combined-schedule query.
7. **Pro starter kits:** add a versioned curated catalog, Pro-home preferences/saved views, installation receipts, item provenance, and guarded preview/install/restore/removal RPCs.

Cross-cutting rules:

- Assignment never grants source access.
- Existing `tasks.user_id` remains intact; assignee is a separate nullable field.
- Existing team grants receive an explicit compatibility mapping before the permission vocabulary is split.
- Cross-artist My Work/schedule results are derived for the signed-in Pro and never stored for artist owners to query.
- Starter-kit role choices are preferences, not permissions. Install targets must be ordinary caller-owned records in `workspace_kind = 'personal'`, deduped by semantic content key and protected from destructive updates.
- All migrations are additive; no reset/drop/truncate path is permitted.
