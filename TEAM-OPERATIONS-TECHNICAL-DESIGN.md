# TEMPO — Team Operations Technical and Data Design

*Status: Implemented in migrations 101–105 and the `lib/api/team-operations.ts` client contract. The migrations are additive and the client treats missing schema capabilities as disabled surfaces.*

**Related:** `TEAM-OPERATIONS-PRODUCT-SPEC.md` · `TEAM-OPERATIONS-UX-SPEC.md` · `TEAM-OPERATIONS-SECURITY-AND-PERMISSIONS.md` · `TECHNICAL-ARCHITECTURE.md` · `DATA-MODEL.md`

---

## 1. Architectural decision summary

1. Extend `artist_members`; do not create a second team-membership system.
2. Keep `artist_member_profiles` and Passage roles as person-owned identity; never copy them per artist.
3. Extend existing `tasks` with assignment fields; do not create duplicate “team tasks.”
4. Build My Work as a secured fan-in query over authoritative sources; do not materialize another mutable inbox table.
5. Add explicit `review_requests` because a requested action has lifecycle not represented by a comment or decision alone.
6. Store Team Brief authored content separately while deriving artist identity, roster, releases, and source work at read time.
7. Reuse `conversations`, `conversation_participants`, and `messages` for team rooms through a one-to-one binding table.
8. Use existing `notifications`, Pulse preferences, realtime invalidation, and message infrastructure.
9. Cross-artist Pro views are user-private queries. No data is copied into an artist-owned aggregate.
10. Every authorization is enforced by RLS or a narrowly scoped server/RPC boundary; client filtering is never authoritative.
11. All schema changes are additive. No production table is dropped, truncated, recreated, or reset.
12. Role-based starter kits are optional personal-workspace content, not membership roles or permission presets.
13. A versioned server-authoritative catalog and one transactional installer produce ordinary user-owned records with provenance; re-running an installation is idempotent and never overwrites edited content.

---

## 2. Existing foundations to preserve

| Concern | Existing foundation | Team Operations use |
|---|---|---|
| Team relationship | `artist_members` | Role, grants, lifecycle, invitation binding |
| Pro identity | `artist_member_profiles`, member Passage/profile | Display identity and self-described industry roles |
| Artist access helpers | `is_artist_member`, `can_read_artist_area`, `can_write_artist_area` | Extended closed-area validation and all policy checks |
| Personal home | `artists.workspace_kind = 'personal'` | Private Pro work and combined operating home |
| Tasks | `tasks` scoped by `space_id` | Assignment and My Work source |
| Feedback | `comments.assigned_to_user_id`, version decisions | Existing assignment source and review result targets |
| Calendar | `calendar_events` and derived Calendar items | Private combined schedule; authoritative edits remain source-owned |
| Notifications | `notifications`, `notify_profile_owner`, Pulse tables | Assignment, review, membership, brief, and mention signals |
| Messaging | `conversations`, `conversation_participants`, `messages` | Artist team room |
| Activity | `activity_events`, calendar activity, message revisions | Source-specific history; new membership history stays separate |
| Query/cache | TanStack React Query | User, artist, and membership-scoped query keys |
| Desktop/offline | shared web app, query persistence, outbox | Capability-detected writes; safe older desktop fallback |

Existing rows must continue to behave exactly as before until a new feature is used.

---

## 3. Logical migration sequence

Do not reserve numeric migration names in documentation. At implementation time, each package uses the next available number after syncing with `origin/main`.

| Logical label | Purpose | Dependency |
|---|---|---|
| `TEAM-01-permission-contract` | Closed area vocabulary, compatibility normalization, policy completion, effective-access RPC | Existing 089–097 team schema |
| `TEAM-02-membership-lifecycle` | Invitation message, suspension/revocation metadata, membership events, leave/suspend/resume/offboard RPCs | TEAM-01 |
| `TEAM-03-work-assignments` | Task assignment fields/history, review requests, secured My Work RPC | TEAM-01 |
| `TEAM-04-team-brief` | Brief, links, pins, private per-member seen state | TEAM-01 and TEAM-02 |
| `TEAM-05-team-room` | Artist-room binding, participant synchronization, link snapshots, pin categories | TEAM-02; existing messaging migrations |
| `TEAM-06-pro-operations` | Availability, per-artist preferences, combined schedule RPC | TEAM-01 and TEAM-03 |
| `TEAM-07-pro-starter-kits` | Curated kit catalog, Pro-home preferences/saved views, installation receipts/provenance, transactional preview/install | TEAM-06; existing templates, projects, tasks, and checklists |

Permission and lifecycle packages must land before room/assignment UI that depends on them. A migration can be split if schema CI or RLS review benefits, but packages may not be combined to bypass gates.

---

## 4. Permission contract

### 4.1 Closed vocabulary

Extend the application and database vocabulary to:

```text
catalog
audio
feedback
tasks
calendar
releases
stats
performances
social
team
```

Levels remain `none | read | write`. The database validation function must reject unknown keys as well as invalid values. Today it validates values only; TEAM-01 tightens the shape without invalidating existing rows by normalizing known keys first.

### 4.2 Compatibility

- Existing grants remain valid.
- Missing new keys mean `none`.
- Current `catalog` does not silently imply `audio`, `feedback`, or `tasks` after the new UI ships.
- Before that semantic split is activated, a compatibility function maps legacy role presets to explicit new grants so an existing manager does not unexpectedly lose the access the old product actually provided.
- The migration writes only the missing derived keys; it does not overwrite a user's explicit existing values.
- `lib/team/areas.ts` remains the client contract, but database functions also enforce the exact key set.

### 4.3 Effective access

Add a read-only RPC:

```sql
effective_artist_access(p_artist_id uuid, p_user_id uuid default auth.uid())
```

It returns the normalized closed-key grant object plus immutable capability flags such as `is_owner`, `is_active_member`, and `is_suspended`. Only the caller's own effective access or an artist owner's view of their own member may be returned.

UI navigation, invitation summaries, and policy tests use the same vocabulary. The RPC is descriptive; RLS helpers remain authoritative.

### 4.4 Space-scoped helpers

Policies on tasks, tracks, projects, events, and their children must not depend on an RLS-filtered subquery that can silently disappear. Add SECURITY DEFINER helpers with ID-only arguments:

```sql
artist_id_for_space(p_space_id uuid) returns uuid
can_read_space_area(p_space_id uuid, p_area text) returns boolean
can_write_space_area(p_space_id uuid, p_area text) returns boolean
```

They are `stable`, set `search_path = public`, return only identifiers/booleans, and are revoked from `public`/`anon` before granting to `authenticated`.

---

## 5. Membership lifecycle data

### 5.1 Alter `artist_members`

Add nullable fields without rewriting current active rows:

| Column | Type | Notes |
|---|---|---|
| `relationship_label` | text null | Optional custom display label, 1–80 chars |
| `invite_message` | text null | Plain text, maximum 1,000 chars |
| `suspended_at` | timestamptz null | Immediate access stop |
| `suspended_by_user_id` | uuid null → auth.users SET NULL | Actor |
| `revoked_at` | timestamptz null | Historical end time |
| `revoked_by_user_id` | uuid null → auth.users SET NULL | Actor |
| `ended_reason` | text null | Short enum, not freeform creative content |
| `updated_at` | timestamptz | Trigger-maintained |

Extend status to `pending | active | suspended | revoked | declined`. Existing revoked rows remain unchanged. Authorization helpers require exactly `active`.

`ended_reason` values:

```text
left_by_member
ended_by_owner
invite_declined
invite_expired
account_removed
```

Do not store raw invite tokens, provider payloads, or private owner notes in these new fields.

### 5.2 `artist_membership_events`

Append-only history:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `artist_id` | uuid FK artists CASCADE | Scope |
| `membership_id` | uuid FK artist_members SET NULL | Historical row may outlive nullable link only if future deletion exists |
| `subject_user_id` | uuid null SET NULL | Person affected |
| `actor_user_id` | uuid null SET NULL | Person who acted; null for system expiry |
| `event_type` | text | Closed enum |
| `changes` | jsonb | Allowlisted role/access/status deltas only |
| `created_at` | timestamptz | Immutable |

Event types:

```text
invited, accepted, declined, role_changed, access_changed,
suspended, resumed, left, revoked, work_reassigned
```

`changes` may store old/new role and normalized area levels. It must never store emails, token hashes, message bodies, filenames, track titles, task titles, or notes.

### 5.3 Lifecycle RPCs

All multi-row lifecycle operations are transactional SECURITY DEFINER RPCs:

- `respond_to_artist_invite(p_membership_id, p_accept)`
- `suspend_artist_member(p_membership_id)`
- `resume_artist_member(p_membership_id)`
- `leave_artist_team(p_membership_id, p_assignment_plan jsonb)`
- `end_artist_member_access(p_membership_id, p_assignment_plan jsonb)`

Each RPC:

1. Re-checks caller authority and current state.
2. Locks the membership row.
3. Validates every reassignment target against the same artist and effective Tasks/Feedback access.
4. Applies assignment outcomes.
5. Changes membership state.
6. Synchronizes team-room participation.
7. Writes a membership event.
8. Creates grouped notifications.
9. Returns the new state plus affected counts, never hidden creative content.

### 5.4 Offboarding preview

Read-only RPC:

```sql
preview_artist_member_offboarding(p_membership_id uuid)
```

Returns counts and allowlisted labels for open tasks, review requests, assigned comments, and future calendar events belonging to that artist. It must not include other artists or any source the caller cannot read. The preview does not mutate state and is always revalidated inside the final transaction.

---

## 6. Task assignments

### 6.1 Alter `tasks`

| Column | Type | Notes |
|---|---|---|
| `created_by_user_id` | uuid null → auth.users SET NULL | Backfill from current `user_id` where safe |
| `assigned_to_user_id` | uuid null → auth.users SET NULL | Owner or active eligible team member |
| `assigned_by_user_id` | uuid null → auth.users SET NULL | Last assigner |
| `assigned_at` | timestamptz null | Last assignment time |
| `updated_at` | timestamptz | Trigger-maintained if not already present |

Keep `tasks.user_id` for backward compatibility and existing ownership semantics. It must not be repurposed as the assignee.

Indexes:

```text
(assigned_to_user_id, status, due_date) where assigned_to_user_id is not null
(space_id, status, due_date)
```

### 6.2 `task_assignment_events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `task_id` | uuid FK tasks CASCADE | |
| `artist_id` | uuid FK artists CASCADE | Denormalized and trigger-validated for safe history scope |
| `from_user_id` | uuid null SET NULL | |
| `to_user_id` | uuid null SET NULL | Unassigned allowed |
| `actor_user_id` | uuid null SET NULL | |
| `created_at` | timestamptz | Append-only |

No title or notes are copied into history.

### 6.3 Assignment validation

An assignee is eligible when:

- They own the artist; or
- They have an active membership for the artist with Tasks Read or Write.

Creating/editing/reassigning requires Tasks Write, except:

- The current assignee may mark their assigned task done/doing and add permitted notes with Tasks Read plus explicit assignee capability if the final permission matrix approves that narrow behavior.
- Default decision: require Tasks Write for edits other than status; allow assignee status updates through a narrow RPC.

Use RPCs for assignment changes:

- `assign_artist_task(p_task_id, p_assignee_user_id)`
- `set_assigned_task_status(p_task_id, p_status)`

They create assignment history and notifications server-side.

### 6.4 Task RLS completion

Add member SELECT/INSERT/UPDATE policies using `can_read_space_area(space_id, 'tasks')` and `can_write_space_area(space_id, 'tasks')`. Delete remains owner-only in the first release. Existing owner policies are preserved.

Project and track foreign keys do not grant access by themselves. A user reading a task receives linked labels only when they can read the linked source; serializers/UI must fall back to a generic context label when necessary.

---

## 7. Review requests

### 7.1 `review_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `artist_id` | uuid FK artists CASCADE | Security scope |
| `space_id` | uuid FK spaces CASCADE | Query/deep-link context |
| `request_type` | text | `bounce_review`, `version_decision`, `comment_followup`, `release_check` |
| `track_id` | uuid null FK tracks CASCADE | Required for track/version/comment kinds |
| `version_id` | uuid null FK versions SET NULL | Fixed requested version |
| `comment_id` | uuid null FK comments SET NULL | Follow-up target |
| `project_id` | uuid null FK projects CASCADE | Release check target |
| `requested_by_user_id` | uuid SET NULL | |
| `assigned_to_user_id` | uuid SET NULL | Active eligible member/owner |
| `request_text` | text | 1–1,000 chars |
| `due_at` | timestamptz null | Explicit timezone handled in UI |
| `status` | text | `open`, `completed`, `cancelled` |
| `result_type` | text null | Closed source-appropriate enum |
| `decision_id` | uuid null FK version_decisions SET NULL | Result link |
| `completed_at` | timestamptz null | |
| `completed_by_user_id` | uuid null SET NULL | |
| `created_at`, `updated_at` | timestamptz | |

Constraints enforce a valid source shape for each `request_type`. A bounce/version request keeps its `version_id` even after a newer version arrives. If the version is deleted, the request remains with a clear unavailable-source state unless cascade policy is explicitly chosen during migration review; default is `SET NULL` plus retained track context.

### 7.2 Permissions

- Feedback Write creates and manages bounce, decision, and comment requests.
- Releases Write creates and manages release checks.
- Assignee may read and complete their open request even if their area is Read, provided they retain access to the underlying source.
- Owner may cancel/reassign any request for their artist.
- No guest review request in this initiative.

### 7.3 Completion

Completion is an RPC per kind so the result and request close atomically:

- `complete_bounce_review`
- `complete_version_decision_request`
- `complete_comment_followup`
- `complete_release_check`

The RPC either writes/links the authoritative result and closes the request or changes nothing.

---

## 8. My Work query architecture

### 8.1 No duplicate inbox table

My Work is a fan-in read over:

- Open tasks where `assigned_to_user_id = auth.uid()`
- Unresolved comments where `assigned_to_user_id = auth.uid()`
- Open `review_requests` where `assigned_to_user_id = auth.uid()`
- Optional personal-home open tasks owned by the user

Notifications are not a work source. They signal changes and deep-link to these rows.

### 8.2 RPC contract

```sql
my_work_inbox(
  p_artist_id uuid default null,
  p_kind text default null,
  p_state text default 'open',
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 50
)
```

Return allowlisted rows:

| Field | Purpose |
|---|---|
| `kind`, `source_id` | Stable identity |
| `artist_id`, `artist_name`, `artist_emblem_path` | Cross-artist context caller may see |
| `space_id` | Context switch |
| `title`, `context` | Allowlisted display text from readable source |
| `due_at`, `urgency` | Ordering/reason |
| `requested_by_name` | Human context when readable |
| `primary_action`, `href` | Server-selected safe route/action kind |
| `updated_at` | Keyset pagination |

Implementation options:

- Prefer a SECURITY INVOKER SQL function over RLS-protected sources.
- If planner/RLS nesting makes the union unreliable, use SECURITY DEFINER only with explicit `auth.uid()` predicates and the same helper functions; revoke public/anon execution and return a fixed allowlist.
- No materialized view or fan-out table until measured scale requires it.

### 8.3 Urgency

Urgency is computed from explicit facts:

1. Overdue
2. Due today
3. Review requested with no due date
4. Upcoming due date
5. Open without date

No composite productivity score.

---

## 9. Team Brief data

### 9.1 `artist_team_briefs`

| Column | Type | Notes |
|---|---|---|
| `artist_id` | uuid PK FK artists CASCADE | One brief per artist |
| `welcome_note` | text null | 4,000 chars |
| `working_norms` | text null | 6,000 chars |
| `timezone` | text null | Valid IANA name |
| `working_rhythm` | text null | 1,000 chars |
| `brief_version` | int | Increment on material authored changes |
| `updated_by_user_id` | uuid null SET NULL | |
| `created_at`, `updated_at` | timestamptz | |

Do not copy public artist story, roster, releases, tasks, or stats into this table.

### 9.2 `artist_team_brief_links`

`id`, `artist_id`, `label`, `url`, `sort`, timestamps. URLs are `http(s)` only, maximum lengths enforced. No server metadata fetch.

### 9.3 `artist_team_brief_pins`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `artist_id` | uuid FK artists CASCADE | |
| `track_id` | uuid null FK tracks CASCADE | |
| `project_id` | uuid null FK projects CASCADE | |
| `task_id` | uuid null FK tasks CASCADE | |
| `calendar_event_id` | uuid null FK calendar_events CASCADE | |
| `note` | text null | 500 chars |
| `sort` | int | |

Constraint: exactly one target FK is non-null. A trigger validates that target belongs to the same artist.

### 9.4 Private seen state

`artist_team_brief_seen(user_id, artist_id, last_seen_version, updated_at)` is user-owned. Artists cannot query another user's row. It exists only to show Updated to the member and must not power analytics or read receipts.

### 9.5 Read model

`fetchArtistTeamBrief` composes:

- Authored brief/links/pins
- Readable artist profile fields
- Active roster names/roles
- Effective access for caller
- Readable pinned source summaries
- Current release/readiness summary when Releases Read

Each source can fail independently. The serializer never substitutes service-role reads for missing caller permissions.

---

## 10. Team room architecture

### 10.1 `artist_team_rooms`

| Column | Type | Notes |
|---|---|---|
| `artist_id` | uuid PK FK artists CASCADE | One room per artist |
| `conversation_id` | uuid UNIQUE FK conversations CASCADE | Existing `kind = 'group'` |
| `created_by_user_id` | uuid SET NULL | |
| `created_at` | timestamptz | |

Create lazily through `ensure_artist_team_room(p_artist_id)`. It must be idempotent and safe under concurrent calls.

### 10.2 Participants

Active owner + active team members are materialized in `conversation_participants`, following the proven Scene-chat pattern. Suspension/revocation sets `left_at`; resume clears it. Synchronization occurs in lifecycle RPCs plus a repair RPC/job for drift.

Team members send as their own eligible profile/persona. No managed-artist sender mode is introduced.

### 10.3 Linked work cards

Add `message_work_links`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `message_id` | uuid FK messages CASCADE | |
| `artist_id` | uuid FK artists CASCADE | Scope |
| one nullable target FK | task/track/project/review/event/version | Exactly one |
| `snapshot` | jsonb | Allowlisted label/type only |
| `created_at` | timestamptz | |

Snapshot prevents a linked card from requiring broader source joins. It must never contain notes, filenames, audio paths, private comments, message text, or email. Opening the card still requires current source access.

### 10.4 Pin categories

Extend existing conversation message pins with nullable `pin_kind = decision | handoff | reference` for artist team rooms. Existing pins remain valid with null/general kind. Only room admins/artist owner may pin until delegated Team Write ships.

### 10.5 Realtime

Reuse `conversation:<id>` authorization and invalidation. Membership lifecycle removes participant access before broadcasting sensitive content. Reconnect refetches participant state before messages.

---

## 11. Pro operations data

### 11.1 `pro_availability`

One user-owned row:

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK | |
| `status` | text | `available`, `limited`, `unavailable` |
| `until_date` | date null | |
| `note` | text null | 160 chars |
| `timezone` | text null | IANA |
| `working_days` | smallint[] | 1–7, validated |
| `share_with_teams` | boolean | Default false |
| `updated_at` | timestamptz | |

Other users may read only an allowlisted projection through `shared_pro_availability(p_user_ids uuid[])`, and only when they share an active artist membership/ownership relationship and `share_with_teams` is true.

### 11.2 `artist_member_preferences`

Composite unique `(artist_id, user_id)`; user-owned:

- `notification_level`: all / assignments_mentions / urgent / muted
- `calendar_color_override`: nullable validated color token, local/private
- `last_pro_home_visit_at`
- timestamps

Artist owners cannot read another member's notification choice or private color.

### 11.3 Combined schedule RPC

`my_artist_schedule(p_from, p_to, p_artist_ids default null)` returns only calendar/derived items already readable by the caller through active grants, plus their personal workspace events. It must:

- Cap date range and result count
- Preserve authoritative source ids/deep links
- Use keyset/range indexes
- Return artist context only to the caller
- Compute overlap flags in the client or within the private result set
- Never persist or expose conflict results to an artist

External calendar sync is outside this design.

### 11.4 Role-based starter-kit catalog

Starter kits are curated product data, not arbitrary user-authored scripts. The canonical catalog is seeded additively with the migration and contains no executable code.

`pro_starter_kits`:

| Column | Type | Notes |
|---|---|---|
| `key` | text | Closed key: `manager`, `label`, `publicist`, `tour_manager`, `agent`, `assistant`, `custom` |
| `version` | integer | Monotonic within key |
| `display_name` | text | Product-owned copy |
| `home_lens` | text | Allowlisted Pro-home emphasis |
| `status` | text | `draft`, `active`, `retired` |
| `created_at` | timestamptz | |

Unique `(key, version)`. Only one active version per key.

`pro_starter_kit_definitions` stores ordered, versioned catalog items:

| Column | Type | Notes |
|---|---|---|
| `kit_key`, `kit_version` | text, integer | Composite FK to catalog |
| `content_key` | text | Stable semantic id used for cross-kit dedupe |
| `item_kind` | text | Closed enum: `home_module`, `saved_view`, `task_template`, `checklist_template`, `project_template`, `sample_project`, `sample_task` |
| `payload` | jsonb | Validated kind-specific shape; no HTML, SQL, secrets, person ids, URLs, or dates |
| `sort_order` | integer | Deterministic preview/install order |

Catalog content is readable to authenticated users only through an allowlisted preview function. The client never receives retired/draft definitions or uses catalog payload as executable UI/schema instructions.

### 11.5 Pro-home settings and saved views

`pro_home_preferences` is one user-owned row:

- `user_id` uuid PK
- `primary_lens` closed text key
- `module_order` text[] of closed module keys
- `hidden_modules` text[] of closed module keys
- `starter_prompt_state` `unseen`, `remind_later`, `completed`, or `blank`
- `starter_prompt_version` integer
- `remind_after` timestamptz null
- `updated_at` timestamptz

`pro_saved_views` stores user-owned named filter configurations for My Work, Schedule, Roster, or future Pro-home modules. Filters are validated against each surface's closed schema. A saved view never stores a result set, artist title, task title, or expanded cross-artist data.

### 11.6 Installation receipts and provenance

`pro_starter_kit_installations`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | Must equal caller |
| `workspace_artist_id` | uuid | Caller-owned `workspace_kind = 'personal'` only |
| `selected_kits` | text[] | Normalized sorted kit keys |
| `kit_versions` | jsonb | Server-built key-to-version map |
| `primary_lens` | text | Chosen allowlisted lens |
| `mode` | text | `templates_only` or `templates_and_samples` |
| `request_id` | uuid | Client retry id; unique with user |
| `status` | text | `installed`, `partially_restored`, `removed_examples` |
| `created_at` | timestamptz | |

`pro_starter_kit_items` maps an installation to each created or reused record:

- `installation_id`
- `content_key`
- `target_kind`
- `target_id`
- `disposition` (`created`, `already_present`, `skipped`)
- `initial_fingerprint` for detecting whether a created sample remains untouched
- unique `(installation_id, content_key)`

The mapping is provenance, not authority. Target records retain their normal owner and RLS rules.

### 11.7 Preview, install, restore, and removal contracts

`preview_pro_starter_kits(p_kit_keys, p_primary_lens, p_include_samples)` returns a deterministic, deduplicated plan and counts without writing. It validates role keys but does not treat Passage roles as authorization.

`install_pro_starter_kits(p_kit_keys, p_primary_lens, p_include_samples, p_request_id)` runs in one transaction and:

1. Requires the caller's personal Pro workspace.
2. Loads active catalog versions server-side.
3. Deduplicates shared `content_key` values across selected kits.
4. Applies layout preferences without replacing a user-customized layout unless the confirmation explicitly names that reset.
5. Creates templates through kind-specific adapters into existing authoritative tables.
6. Creates sample projects/tasks only in the personal workspace and labels them as private starter examples.
7. Writes receipts/provenance and returns Added, Already present, and Skipped.
8. Returns the prior result for a repeated `(user_id, request_id)`.

Restore is additive: it recreates only missing semantic keys. Removal deletes only sample targets that are still owned by the caller, still in the personal workspace, and whose current fingerprint matches the installation fingerprint. Edited samples and all templates/layout changes require ordinary user-directed deletion/reset; the kit updater never overwrites or silently removes them.

---

## 12. Client modules and query keys

### Proposed modules

| Module | Responsibility |
|---|---|
| `lib/api/team-access.ts` | Effective access and owner member management |
| `lib/api/team-lifecycle.ts` | Invite preview, suspend/resume/leave/end, history |
| `lib/api/work-assignments.ts` | Assignment, review request, My Work |
| `lib/api/team-brief.ts` | Composed brief reads and authored mutations |
| `lib/api/team-room.ts` | Ensure/open room, linked-work picker/cards |
| `lib/api/pro-operations.ts` | Availability, preferences, combined schedule |
| `lib/api/pro-starter-kits.ts` | Preview/install/restore starter kits and remove untouched examples |
| `hooks/use-team-access.ts` | Query/mutations for access |
| `hooks/use-my-work.ts` | Infinite/paginated queue and mutations |
| `hooks/use-team-brief.ts` | Brief query/mutations |
| `hooks/use-team-room.ts` | Room lookup and participant sync state |
| `hooks/use-pro-operations.ts` | Schedule, availability, preferences |
| `hooks/use-pro-starter-kits.ts` | Prompt state, preview, install result, installed-kit status |

Do not overload `hooks/use-artist-members.ts` into an all-purpose team hook.

### Query keys

```text
["team-members", artistId]
["team-effective-access", artistId, userId]
["team-membership-history", artistId, membershipId]
["team-offboarding-preview", membershipId]
["my-work", userId, artistFilter, kindFilter, state]
["artist-waiting", artistId, personFilter, kindFilter]
["team-brief", artistId, viewerUserId]
["team-room", artistId]
["pro-schedule", userId, from, to, artistFilter]
["pro-availability", userId]
["artist-member-preferences", userId, artistId]
["pro-starter-kits", "catalog"]
["pro-starter-kit-preview", userId, selectedKitHash, primaryLens, includeSamples]
["pro-starter-kit-installations", userId]
["pro-home-preferences", userId]
```

Never use only `["team"]` or only `["tasks"]` for cross-user/member-sensitive caches.

### Invalidation

- Assignment: tasks, My Work, artist Waiting, Today, Calendar if due date changed, Notifications.
- Membership state/access: artists, spaces, active artist, effective access, roster, My Work, schedule, team room, search catalog.
- Brief: brief and relevant notification group.
- Room link: conversation messages/pins only; source caches remain authoritative.
- Sign-out/account switch: clear all React Query memory/persistence exactly as current account-switch safeguards require.
- Starter-kit install/restore: installations, Pro-home preferences, saved views, templates, projects, tasks, Today, and My Work.

---

## 13. Routes and components

### Existing routes extended

- `/team` — mode-aware Pro operations or artist Team
- `/tasks` — assignee fields/filters
- `/calendar` — private Pro combined-schedule entry/deep links
- `/messages` — Teams conversation section
- `/track/[id]` — request review and assignment entry points
- `/projects/[id]` — release-check requests

No new top-level route is required for the first release. If `/team` becomes too mode-complex, a later `/work` alias may redirect to `/team?tab=work`; do not duplicate page implementations.

### Proposed component boundaries

```text
components/team/
  team-tabs.tsx
  permission-summary.tsx
  permission-editor.tsx
  invitation-flow.tsx
  invitation-review.tsx
  member-access-sheet.tsx
  member-lifecycle-review.tsx
  team-waiting.tsx
  team-brief.tsx
  team-brief-editor.tsx
  team-room-entry.tsx
  pro-operations-home.tsx
  pro-schedule.tsx
  pro-starter-kit-prompt.tsx
  pro-starter-kit-preview.tsx
  pro-starter-kit-result.tsx

components/work/
  my-work-queue.tsx
  work-item-row.tsx
  assignee-picker.tsx
  review-request-dialog.tsx
```

Keep display components separate from mutation orchestration. Shared permission summaries must consume normalized access, never raw JSON.

---

## 14. Offline and desktop compatibility

Classification: primarily **shared-web**. No native Electron feature is required.

- Older desktop shells load the new web UI automatically, so the web app must capability-detect only native behaviors it actually uses.
- Assignment and membership lifecycle mutations require an online server transaction. Do not enqueue permission changes, invitations, suspension, revocation, reassignment, review completion, or room membership into the generic offline outbox.
- Existing safe task status/due-date offline behavior may continue only when it does not cross assignment authority. An assigned task status update queued offline must be revalidated on sync; a rejected write restores server truth.
- My Work and Team Brief may use persisted last-successful reads with a visible offline/stale label and no claim that access is current.
- Team room follows existing messaging offline/draft behavior.
- Cross-boundary changes are not planned. If later native notifications use team events, follow the desktop native-first/web-fallback release policy.
- Starter-kit preview may be cached, but install/restore/removal require an online transaction and are never queued in the offline outbox.

---

## 15. Performance and pagination

- My Work uses keyset pagination, default 50, hard cap 100.
- Membership history uses keyset pagination, default 30.
- Team room uses existing message pagination.
- Combined schedule caps range at 93 days and rows at a reviewed limit.
- Team Brief pins/links cap at 24 each in v1.
- Invitation search keeps current bounded profile search.
- Add indexes before exposing cross-artist queries; validate with `EXPLAIN (ANALYZE, BUFFERS)` on synthetic non-production data.
- Do not add materialized views, background fan-out, or a work-inbox table until measured usage proves fan-in inadequate.

---

## 16. Failure and compatibility behavior

- Missing migration/table: affected module shows “Team operations needs an update” only in development/admin health; production deploy gate prevents partial enablement.
- Permission changed: source query returns denied/empty, active artist context exits, caches clear.
- Membership suspended while offline: cached data remains visually marked offline but all writes fail closed; reconnect clears it.
- Deleted target: assignment/review row shows source unavailable and allows owner cancel/reassign where safe.
- Member without public Social profile: team functionality uses member profile identity and must not require public visibility.
- Existing direct/group/Scene conversations remain unchanged because the binding table identifies team rooms.
- Legacy `areas` rows normalize safely; unknown keys are ignored client-side and rejected on future writes.
- A catalog/client version mismatch fails before installation with a refresh prompt; it never applies a partial client-authored payload.

---

## 17. Technical acceptance checklist

- [ ] No second membership, task, calendar, notification, or message system is introduced.
- [ ] New permission keys have matching UI, RLS, helpers, and tests.
- [ ] Existing team grants receive a documented compatibility mapping.
- [ ] Assignment history and notifications are server-created.
- [ ] Offboarding is transactional and revalidates its preview.
- [ ] My Work is fan-in-on-read and user-private.
- [ ] Review completion is atomic with its authoritative result.
- [ ] Team Brief copies no artist/release/task source data unnecessarily.
- [ ] Team room is one-to-one with artist and syncs participants with active membership.
- [ ] Cross-artist schedule results never become artist-visible persisted data.
- [ ] Query keys include user/artist/membership context.
- [ ] Offline behavior fails closed for access and assignment authority.
- [ ] Starter-kit installation is opt-in, personal-workspace-only, server-validated, idempotent, and provenance-tracked.
- [ ] Multi-kit installs deduplicate semantic content and never overwrite user-edited records.
- [ ] All migrations are additive and use the next available number at implementation time.
