# TEMPO — Future Feature Prompt Pack

Paste these into Cursor **one work package at a time, in order**. Do not paste the entire file at once. Each prompt assumes the previous work package has been completed, manually tested, and deployed successfully.

These prompts are written for the current TEMPO codebase: Next.js 14 App Router, TypeScript, Tailwind, Supabase, TanStack React Query, WaveSurfer, and the existing Spectra design system.

## Product decisions used throughout

These defaults remove ambiguity while keeping the architecture extensible:

- Guest reviewers do not need an account.
- Guest links are tied to one fixed version, expire after 14 days by default, and can be revoked at any time.
- Guest downloads are disabled by default.
- Stage recipes show a preview before running by default; users may explicitly switch an individual recipe to automatic execution.
- Pinned milestone versions are exempt from the normal two-version pruning rule. TEMPO still keeps only the two newest **unpinned** versions.
- Focus sessions include a timer, but timestamps in the database are the source of truth.
- The first notification system is in-app only. Do not add an email provider yet.
- Collaboration begins at the track level instead of converting the entire product into a team workspace.
- Workspace customization uses bounded presets and module ordering, not a freeform dashboard builder.
- Avoid fake AI features. Any future intelligence should be explainable from real TEMPO data.

---

# Prompt 0 — Create the living feature and architecture specifications

```text
Read these files fully before editing anything:
- .cursorrules
- tempo-design-spec.md
- PRODUCT.md
- CHANGELOG.md
- PROMPTS.md
- schema.sql
- package.json
- lib/types.ts
- lib/constants.ts
- app/(app)/track/[id]/page.tsx
- every component in components/track
- every hook and API module related to tracks, versions, sessions, tasks, projects, stages, assets, and checklists

This work package is documentation and architecture planning only. Do not implement the new product features yet and do not alter the live database.

Create the following living documents in the repo root:

1. FEATURE-SPECS.md
   - Describe all planned feature areas:
     - redesigned track workspace
     - next move / blockers / waiting-on
     - explainable momentum and attention signals
     - timestamped waveform comments
     - guest feedback links
     - version milestones
     - version decisions and approvals
     - blind A/B comparison
     - stage recipes
     - focus sessions
     - reference and inspiration board
     - release workspace
     - lightweight track collaboration
     - activity history and in-app notifications
     - workspace layout presets
     - Today and Board prioritization
   - For every feature include: user problem, primary flows, empty/loading/error states, permissions, mobile behavior, accessibility, and non-goals.

2. TECHNICAL-ARCHITECTURE.md
   - Document the architecture that exists today.
   - Define the intended client/server boundaries for authenticated app data, public guest review routes, signed private audio URLs, and future collaboration.
   - Explicitly state that the service-role key may only be used in server-only modules and route handlers.
   - Define query-key conventions and mutation invalidation expectations for TanStack React Query.
   - Define how public routes remain outside authenticated middleware without opening private app routes.

3. DATA-MODEL.md
   - Document current tables first.
   - Add proposed tables/columns for every planned work package.
   - Include foreign keys, indexes, delete behavior, ownership, RLS intent, and data-retention behavior.
   - Clearly distinguish current schema from proposed schema.
   - Never propose dropping or recreating production tables.

4. DESIGN-SYSTEM-V2.md
   - Preserve the existing Spectra tokens and restrained shader use.
   - Define the redesigned track workspace: larger spatial zones, fewer nested bordered cards, tabbed work panel, stage timeline, Now/Next/Blocked strip, version timeline, waveform annotations, ambient artwork tint, responsive behavior, and accessible motion.
   - Include exact interaction states and component hierarchy, not just visual adjectives.

5. IMPLEMENTATION-PLAN.md
   - Use the exact work-package order in this prompt pack.
   - Describe dependencies between packages, migration order, rollback approach, and manual verification checkpoints.
   - Include a “do not proceed” gate after every database migration until the user confirms it ran successfully in Supabase.

6. SECURITY-AND-PERMISSIONS.md
   - Threat-model guest review links, public comments, private signed audio, collaborator invitations, RLS changes, token storage, accidental data exposure, and abuse controls.
   - Define a permissions matrix for owner, editor, uploader, commenter, viewer, and guest reviewer.

7. TESTING-STRATEGY.md
   - Define manual regression coverage for desktop, mobile, reduced motion, auth, private storage, version pruning, guest links, RLS, and offline/PWA behavior.
   - Do not add a test dependency in this package. Note where automated tests would provide the most value later.

Update .cursorrules so future Cursor work must consult these documents in addition to tempo-design-spec.md. Do not make PRODUCT.md claim that roadmap features already exist. Add one plain-English CHANGELOG entry saying the next-generation product and technical specifications were added, but no user-facing behavior changed.

Run npm run build. Fix only documentation-adjacent or pre-existing build issues necessary to complete the build; do not implement roadmap features.

Bump package.json and lib/version.ts using the project semver rules, keeping them identical.

At the end, report:
- files created or changed
- architectural decisions made
- unresolved decisions that are genuinely blocking
- build result
- a short manual document-review checklist
```

---

# Prompt 1 — Redesign the track workspace foundation

```text
Read .cursorrules and all living specification documents before starting. Audit the current track page and its child components before editing.

Implement the track workspace visual and component foundation described in DESIGN-SYSTEM-V2.md. This package changes layout and interaction structure but does not add collaboration, comments, automations, or new database tables.

Goals:
- Make the track page feel like a focused studio workspace instead of a collection of similarly weighted admin cards.
- Preserve every current function: title editing, cover upload, metadata, stage, momentum, deadline, waveform playback, version upload/actions, checklist, assets, session log, notes, details, and track deletion.

Required layout:

1. Track identity header
   - Keep artwork, back navigation, title, technical metadata, stage, momentum, and deadline.
   - Add a restrained artwork-derived ambient tint behind only the track header region.
   - Do not introduce a full-page artwork background.
   - Derive the tint in the browser without adding a dependency. Provide a deterministic fallback from the track id when artwork color extraction is unavailable.
   - Maintain readable contrast and reduced-motion behavior.

2. Stage timeline
   - Show every stage in the active track’s space as a compact horizontal timeline.
   - Clearly distinguish completed-looking prior stages, current stage, and future stages without falsely recording historical completion.
   - Clicking a stage changes the stage using the existing mutation path and asks for confirmation only when the jump skips more than one stage.
   - On narrow screens, use horizontal scrolling with the current stage scrolled into view.

3. Primary work area
   - Keep the waveform/player as the dominant element.
   - Keep versions immediately below it for now.
   - Keep the session log in the main column.
   - Reduce unnecessary nested borders. Use surface changes, spacing, section labels, and thin dividers instead of putting every subsection in another heavy card.

4. Sticky work panel
   - Replace the long right-column stack with tabs:
     - Work: checklist
     - Files: assets and artwork
     - Notes: freeform notes
     - Details: metadata
   - Preserve component state when switching tabs.
   - On desktop, the panel may remain sticky within the viewport without covering the shell.
   - On mobile, render the tabs as a horizontally scrollable segmented control and keep normal document flow.
   - Deep-link the active tab through a query parameter such as ?panel=files, while defaulting safely to Work.

5. Component architecture
   - Refactor app/(app)/track/[id]/page.tsx so it orchestrates data and selection but does not become a giant presentation component.
   - Create focused layout components where useful, such as TrackWorkspaceShell, TrackStageTimeline, TrackWorkPanel, and TrackAmbientHeader.
   - Do not duplicate existing query calls unnecessarily.

6. Accessibility and interaction
   - Full keyboard navigation for tabs and stage timeline.
   - Correct tab roles and aria relationships.
   - Visible focus states using existing tokens.
   - No hover-only essential controls.
   - Preserve readable layout at 320 px width.

7. Loading and failure states
   - Redesign the track-page skeleton to match the new regions.
   - If artwork tint extraction fails, silently fall back without breaking the page.
   - If stages fail to load, keep the rest of the workspace usable and show a small inline warning.

Do not add dependencies. Do not alter the database.

Update FEATURE-SPECS.md and DESIGN-SYSTEM-V2.md with any implementation-level decisions. Update PRODUCT.md only to describe the workspace redesign that now exists. Update CHANGELOG.md, package.json, and lib/version.ts.

Run npm run build and fix all new errors.

Return a manual checklist covering desktop, mobile, keyboard tabs, stage changes, artwork/no-artwork, version playback, uploads, checklist, notes, details, and delete behavior.
```

---

# Prompt 2 — Next move, blockers, waiting-on, and explainable momentum

```text
Read all project rules and living specifications. Review the current tracks schema, track APIs/hooks, Board cards, Today page, track header, and track workspace before editing.

Implement the workflow-intelligence layer. It must be based on explicit user-entered facts and transparent calculations, not an opaque score.

Database migration:
- Create migrations/001_track_workflow.sql.
- Never drop, truncate, or recreate anything.
- Add nullable columns to tracks:
  - next_action text
  - next_action_due date
  - blocked_reason text
  - waiting_on text
  - stage_entered_at timestamptz not null default now()
- Add an index useful for active attention queries.
- Add a safe trigger or database function that updates stage_entered_at only when stage_id actually changes, including changes made outside the current client.
- Update schema.sql as the canonical full schema after creating the incremental migration.
- Update TypeScript types and insert/update types.

STOP after generating the migration and show the exact migration filename and run instructions. Continue implementation only after the user confirms the migration ran successfully.

After confirmation, implement:

1. Now / Next / Blocked strip
   - Place a compact strip beneath the player or stage timeline.
   - Show:
     - NOW: current stage
     - NEXT: next_action, editable inline
     - BLOCKED: blocked_reason or waiting_on when present
     - TARGET: next_action_due, falling back to track deadline
   - The strip should remain useful when some values are empty; use short invitations rather than blank labels.

2. Workflow editor
   - Provide an expanded editor for next action, due date, blocked reason, and waiting-on.
   - Saving an empty value clears it.
   - Do not create duplicate global tasks automatically in this package.

3. Explainable attention signals
   - Create a pure utility that derives signals from track data and related counts/dates. Examples:
     - no next move
     - next move overdue
     - track deadline approaching
     - blocked
     - waiting on someone
     - no session in 7+ days
     - in current stage 14+ days
     - unresolved feedback count, when that data becomes available later
   - The utility returns structured signals with id, label, severity, and explanation.
   - Do not combine them into a mysterious numeric momentum score.
   - Keep the existing manual momentum field for artist intent.

4. Track workspace
   - Show the most important one or two signals near the workflow strip.
   - Provide a way to reveal all signals and their explanations.

5. Board
   - Add a restrained next-action line on track cards when present.
   - Add small explicit signal indicators, prioritizing blocked and overdue.
   - Do not overcrowd cards; hide lower-priority signals behind an accessible details affordance.

6. Today
   - Reorder “In motion” using explainable urgency: blocked/overdue first, then approaching deadlines, then inactivity, then remaining active tracks.
   - Show why a track is surfaced.
   - Add a quick action to set or edit the next move.

7. Data access
   - Add focused API functions and React Query hooks.
   - Use optimistic updates where low-risk, with rollback on failure.
   - Invalidate track detail, board tracks, and Today queries correctly.

8. Empty, error, and mobile behavior
   - Inline errors must preserve the user’s typed text.
   - On mobile, the workflow strip may wrap into a two-by-two grid.
   - Do not rely on color alone for severity.

Update specs, current PRODUCT.md, CHANGELOG.md, package.json, and lib/version.ts. Run npm run build.

Return a manual checklist including stage transition timestamp behavior, blocked/cleared states, overdue next actions, Today ordering, Board density, mobile, and rollback on a failed update.
```

---

# Prompt 3 — Timestamped waveform comments

```text
Read all rules/specifications. Inspect the existing comments and feedback tables in schema.sql, the WaveSurfer player, version selection state, storage handling, and track workspace layout.

Implement authenticated owner comments pinned to exact waveform timestamps. This package is for signed-in TEMPO users only; public guest access comes next.

Database migration:
- Create migrations/002_timestamped_comments.sql.
- Preserve the existing comments table and existing rows.
- Extend comments safely with:
  - track_id uuid nullable initially, then backfill from versions and make not null if safe
  - author_user_id uuid nullable references auth.users(id) on delete set null
  - parent_id uuid nullable references comments(id) on delete cascade
  - assigned_to_user_id uuid nullable references auth.users(id) on delete set null
  - resolved_at timestamptz nullable
  - resolved_by_user_id uuid nullable references auth.users(id) on delete set null
  - updated_at timestamptz not null default now()
  - guest_link_id uuid nullable for future use; add it only if the referenced table already exists, otherwise defer the foreign key to Prompt 4
- Keep the existing resolved boolean for backward compatibility and keep it synchronized with resolved_at through application logic or a safe trigger.
- Add indexes for version/timestamp, track/resolved, parent_id, and assignment.
- Rewrite the comments RLS policy safely so owners can access comments belonging to their tracks. Do not create public policies yet.
- Update schema.sql and TypeScript types.

STOP and ask the user to run the migration before continuing.

After confirmation, implement:

1. Waveform marker interaction
   - Add a comments layer integrated with WaveSurfer.
   - A user can pause or seek to a timestamp and choose “Add comment here.”
   - Clicking directly on an empty waveform position may open the composer at that timestamp, but normal seek/play behavior must remain predictable.
   - Render compact markers aligned to the correct timestamp and update them when duration or selected version changes.
   - Markers must be keyboard reachable and expose timestamp, author, status, and comment text to assistive technology.

2. Comment panel
   - Add a Comments section associated with the selected version, integrated into the redesigned work panel or immediately beneath the player according to DESIGN-SYSTEM-V2.md.
   - Sort open comments by timestamp by default, with resolved comments collapsible.
   - Clicking a comment seeks playback to its timestamp.
   - Support create, edit own comment, reply, resolve, reopen, and delete with confirmation.
   - Preserve comments separately per version.
   - Show an “All versions” filter that groups comments by version without misleading timestamp markers on the currently selected waveform.

3. Playback behavior
   - Selecting a comment for another version switches the selected version first, waits for the waveform to be ready, then seeks to the timestamp.
   - Clamp timestamps if a corrupt or changed duration would place a comment after the end.

4. Counts and signals
   - Show unresolved comment count in the work-panel tab label and version rows.
   - Connect unresolved counts to the explainable attention-signal utility from Prompt 2.

5. API and hooks
   - Create lib/api/comments.ts and hooks/use-comments.ts.
   - Use React Query keys scoped by track and version.
   - Use optimistic resolve/reopen where safe; do not optimistically create server ids.

6. Edge cases
   - No versions: explain that a bounce is needed before timestamped comments.
   - Audio load failure: comments remain readable and editable even if seeking is unavailable.
   - Deleted version: cascade deletes its comments, but the deletion confirmation must explicitly mention the comment count before proceeding.
   - Very dense markers: cluster or stack visually without hiding access through the list.
   - Mobile: tapping a marker opens the comment drawer/panel and does not require pixel-perfect input.

Do not implement guest links, collaborator roles, or email notifications in this package.

Update all living specs, PRODUCT.md, CHANGELOG.md, package.json, and lib/version.ts. Run npm run build.

Return a manual checklist using at least two versions and comments at the beginning, middle, and end of a track.
```

---

# Prompt 4 — Secure guest feedback links

```text
Read all rules and especially SECURITY-AND-PERMISSIONS.md. Inspect middleware, Supabase server/client helpers, storage signing, comments, version selection, and production URL handling.

Implement secure, no-account guest review links tied to a fixed version.

Architecture requirements:
- Guest links must never make the audio bucket public.
- Store only a SHA-256 hash of the opaque link token in the database.
- Raw tokens may appear in the generated URL shown once to the owner, but must not be logged or stored.
- Public review validation, signed-audio creation, and guest comment writes must happen in server-only route handlers.
- Add SUPABASE_SERVICE_ROLE_KEY to .env.local.example and Vercel setup documentation. Never expose it through NEXT_PUBLIC variables, client bundles, logs, or error messages.
- Create lib/supabase/admin.ts with a server-only guard.

Database migration:
- Create migrations/003_guest_review_links.sql.
- Add guest_review_links:
  - id uuid primary key
  - track_id uuid not null
  - version_id uuid not null
  - created_by uuid not null
  - token_hash text unique not null
  - label text nullable
  - expires_at timestamptz nullable
  - revoked_at timestamptz nullable
  - allow_comments boolean not null default true
  - allow_download boolean not null default false
  - created_at timestamptz not null default now()
  - last_accessed_at timestamptz nullable
- Add guest_name text nullable and guest_link_id uuid nullable to comments if not already present; add the foreign key now.
- Add appropriate indexes.
- Owner-only RLS for managing links. Do not add a broad anon select policy. Server routes using the service role validate tokens.
- Update schema.sql and types.

STOP and ask the user to run the migration and configure the server-only environment variable before continuing.

After confirmation, implement:

1. Owner link manager
   - From the selected version, owner can create a review link.
   - Default expiry: 14 days.
   - Options: label, expiry, allow comments, allow download.
   - Show active, expired, and revoked links.
   - Copy link, revoke, and create replacement.
   - Never show the raw token again after the creation response is dismissed.

2. Public route
   - Add /review/[token] and exempt only /review and the exact required /api/review routes from auth middleware.
   - Render a focused branded page with track title, artwork, version label/number, changelog, waveform, time display, and comments.
   - Do not expose private track metadata, unrelated versions, tasks, notes, assets, project data, or owner email.
   - Add noindex metadata.
   - Return an intentionally generic unavailable state for invalid, expired, and revoked links.

3. Public API routes
   - Validate and hash the token server-side for every request.
   - Return no-store responses.
   - Generate a short-lived signed audio URL only after successful validation.
   - Post guest comments with guest name, timestamp, text, version, track, and guest_link_id.
   - Enforce length limits, trim inputs, reject empty comments, and use a honeypot field.
   - Add pragmatic abuse controls without a new dependency: limit bursts per link using recent database rows, and return a calm retry message.
   - Guest users cannot edit, resolve, delete, assign, or reply in v1.

4. Owner review experience
   - Guest comments appear in the normal authenticated comment panel with a Guest label and link label when available.
   - Owner can resolve or delete them.
   - Revoking a link does not delete comments already received.

5. Downloads
   - When allow_download is false, do not render a download action and do not expose an API path that returns a downloadable response.
   - When true, provide a deliberate Download bounce control.

6. Security and failure handling
   - Do not send service-role errors or database details to guests.
   - Never place signed URLs in static page source or long-lived caches.
   - Ensure referrer policy is restrictive.
   - Verify public routes cannot query arbitrary version ids by changing request parameters.

Update DEPLOYMENT.md with the new server secret and Vercel steps. Update all living specs, PRODUCT.md, CHANGELOG.md, package.json, and lib/version.ts. Run npm run build.

Return a manual security checklist covering valid/invalid/expired/revoked tokens, downloads on/off, guest comment posting, direct API tampering, owner visibility, and private-route protection.
```

---

# Prompt 5 — Milestone versions, decisions, approvals, and blind A/B

```text
Read all rules/specs. Inspect version upload/pruning, version rows, delete confirmations, waveform player, comments, and guest links before editing.

Implement meaningful version history without turning TEMPO into unlimited cloud storage.

Database migration:
- Create migrations/004_version_milestones_and_decisions.sql.
- Add to versions:
  - is_pinned boolean not null default false
  - milestone_type text nullable with allowed values demo, vocal_comp, arrangement_lock, mix_approved, master, custom
  - milestone_label text nullable
  - pinned_at timestamptz nullable
- Create version_decisions:
  - id uuid primary key
  - track_id uuid not null
  - version_id uuid not null
  - decision_type text not null: approved, needs_changes, rejected
  - decision_area text not null: general, arrangement, vocal, mix, master, release
  - note text nullable
  - created_by_user_id uuid nullable
  - guest_name text nullable
  - guest_link_id uuid nullable
  - created_at timestamptz not null default now()
- Add indexes and owner RLS. Guest decision submission is out of scope for now, but the nullable fields keep the model extensible.
- Update schema.sql and types.

STOP for migration confirmation.

After confirmation, implement:

1. Milestone pinning
   - Owner can pin a version and choose a milestone type plus optional custom label.
   - Pinned versions are visibly distinct but restrained.
   - Unpinning requires confirmation if doing so makes the version eligible for pruning.

2. Pruning rule
   - Replace the current “keep latest two total” behavior with:
     - preserve every pinned version
     - preserve the two newest unpinned versions
     - delete older unpinned rows and their storage files after a successful new upload
   - Never prune the current version, even if an inconsistent state occurs; repair or warn safely.
   - Pruning must be deterministic and documented.
   - Upload errors or pruning errors must not delete the new successful upload unexpectedly.

3. Version timeline
   - Replace the flat versions list with a chronological visual timeline that still supports upload, play, current, download, delete, pin, and decision history.
   - Make milestones easy to scan.
   - Show comment count and latest decision summary.
   - On mobile, use a compact vertical timeline rather than horizontal overflow.

4. Decisions and approvals
   - Add “Record decision” to a version.
   - Support Approved, Needs changes, and Rejected with decision area and note.
   - Decisions are append-only history; do not silently overwrite old decisions.
   - Provide a clear latest-state summary while retaining the full decision log.
   - A new version does not automatically invalidate prior approvals, but show that the approval belongs to an older version.

5. Blind A/B mode
   - Add a focused A/B comparison mode between any two available versions.
   - Hide version numbers, labels, dates, changelogs, and milestone identity until the user reveals the result.
   - Label choices A and B, randomize which version maps to each on each new comparison, and keep the mapping only in component state.
   - Provide synchronized seek position as closely as WaveSurfer permits, independent volume, and one-at-a-time playback to prevent accidental overlap.
   - User may choose A, B, no preference, or leave without recording.
   - After reveal, optionally record the selection as a version decision.
   - Do not claim sample-perfect synchronization.

6. Delete safety
   - Version deletion confirmation must mention pinned state, comment count, decisions, and guest links affected.
   - Do not allow deletion when an active guest link targets that version until the owner revokes or retargets the link.

Update all docs and versions. Run npm run build.

Return a manual checklist covering upload/pruning with pinned and unpinned versions, current-version safety, milestones, decisions, A/B randomization, mobile timeline, and deletion dependencies.
```

---

# Prompt 6 — Stage recipes and transition automations

```text
Read all rules/specs. Inspect stage CRUD, Board drag behavior, track stage mutation, checklist templates, tasks, workflow fields, version decisions, and React Query invalidation.

Implement customizable stage recipes that help prepare a track when it enters a stage. Default behavior is preview-before-run.

Database migration:
- Create migrations/005_stage_recipes.sql.
- Create stage_recipes:
  - id uuid primary key
  - stage_id uuid unique not null
  - enabled boolean not null default true
  - execution_mode text not null default 'preview' with preview or automatic
  - actions jsonb not null default '[]'
  - created_at and updated_at
- Create stage_recipe_runs:
  - id uuid primary key
  - recipe_id uuid not null
  - track_id uuid not null
  - stage_id uuid not null
  - transition_key text unique not null
  - status text not null: pending, applied, skipped, partial, failed
  - action_results jsonb not null default '[]'
  - created_at, completed_at
- Add owner RLS through stages/spaces/tracks.
- Document the action JSON schema and validate it in application code.
- Supported v1 action types:
  - apply_checklist_template
  - create_task
  - set_next_action
  - set_momentum
  - request_version_decision (create a task/prompt, not an external notification)
- Update schema.sql and types.

STOP for migration confirmation.

After confirmation, implement:

1. Recipe editor
   - Accessible from the stage editor.
   - Toggle enabled and choose Preview or Automatic.
   - Add, edit, reorder, and delete actions.
   - Use structured forms per action type, not raw JSON.
   - Validate referenced checklist templates and sensible required fields.
   - Explain exactly what will happen when a track enters the stage.

2. Transition detection
   - Centralize stage changes so Board drag, track timeline click, and dropdown changes all create the same transition result.
   - Do not run recipes on initial page load or unrelated track updates.
   - Use a unique transition key so retries or React re-renders cannot duplicate actions.

3. Preview flow
   - After a track enters a stage with a preview recipe, show a review dialog listing proposed actions.
   - Allow deselecting individual actions.
   - User can Apply selected or Skip.
   - Stage change remains applied even if the recipe is skipped.

4. Automatic flow
   - Only recipes explicitly switched to Automatic run without a dialog.
   - Show a clear toast summary with an Undo link when safe.
   - Undo may remove newly created tasks/checklist items and restore workflow values only when they have not since been edited.

5. Execution safety
   - Apply actions sequentially and record per-action result.
   - A failure in one action must not falsely mark all actions successful.
   - Retrying a partial run executes only failed/unapplied actions.
   - Applying a checklist template should avoid duplicate identical items by default and explain what was skipped.

6. Starter recipes
   - Do not silently create recipes for existing users.
   - Offer an explicit “Add suggested recipes” action that proposes sensible recipes for Writing, Production, Mixdown, Master, and Release Prep stages when matching names exist.

7. UI integration
   - Show a small recipe indicator on stage timeline and stage editor.
   - Show recent recipe activity in track activity history later; for now, expose run history in the workflow panel.

Do not add background jobs or email. Update all docs and versions. Run npm run build.

Return a manual checklist for Board drag, timeline stage change, preview deselection, automatic mode, duplicate prevention, partial failure/retry, skip, and no-recipe transitions.
```

---

# Prompt 7 — Focus session mode

```text
Read all rules/specs. Inspect sessions schema/APIs, Today quick log, track player, workflow fields, versions upload, comments, and the redesigned workspace.

Implement an active focus-session workflow that helps the artist define an intention, work with fewer distractions, and close the loop afterward.

Database migration:
- Create migrations/006_focus_sessions.sql.
- Extend sessions safely:
  - user_id uuid nullable initially, backfill through track ownership, then make not null if safe
  - status text not null default 'completed' with active, completed, abandoned
  - goal text nullable
  - outcome text nullable
  - started_at timestamptz nullable
  - ended_at timestamptz nullable
  - elapsed_sec int nullable
  - next_action_after text nullable
  - created_at timestamptz not null default now() if needed
- Preserve note and logged_at compatibility with old session rows.
- Add a partial unique index preventing more than one active session per user.
- Update RLS, schema.sql, and types.

STOP for migration confirmation.

After confirmation, implement:

1. Start flow
   - “Start focus session” appears on the track workspace and Today.
   - Ask for a concise session goal and optionally select relevant checklist items.
   - Starting creates the active session server-side before entering focus mode.
   - If another active session exists, offer Resume or End it first; never create duplicates.

2. Dedicated focus route
   - Add /track/[id]/focus.
   - Use a reduced shell with:
     - track identity
     - session goal
     - elapsed timer
     - waveform and selected version
     - selected checklist items
     - scratch notes
     - reference access
     - End session
   - Hide global navigation distractions while preserving a clear exit path.
   - Warn before leaving with an active unsaved scratch note.

3. Timer behavior
   - Database started_at is authoritative.
   - Timer survives refresh, sleep, and reopening another tab.
   - Do not increment time by writing every second.
   - Ending computes elapsed_sec on the server/client from timestamps and persists it once.
   - Handle device-clock anomalies defensively.

4. End flow
   - Ask:
     - What changed?
     - What is still left?
     - What is the next move?
     - Upload a bounce now? optional
   - Save outcome/note, ended_at, elapsed, and status.
   - If a next move is provided, update track.next_action after explicit confirmation.
   - If a bounce is uploaded, link the session to that version.
   - Mark selected checklist items complete only when individually selected in the closeout flow.

5. Abandon/recovery
   - Allow “End without summary” as Abandoned, with confirmation.
   - If an active session is older than 24 hours, prompt the user to close or resume rather than silently running forever.

6. Session history
   - Upgrade Session Log to show goal, duration, outcome, linked version, and status.
   - Keep old one-field historical sessions readable.
   - Add simple weekly time summary to Today without presenting it as productivity judgment.

7. Mobile/PWA
   - Focus mode must work well as an installed PWA.
   - Prevent accidental screen overflow and keep End session reachable.
   - Do not attempt unsupported background timers or wake locks without asking.

Update all docs and versions. Run npm run build.

Return a manual checklist covering refresh persistence, second-tab conflict, 24-hour recovery, upload linkage, next-action update, old session compatibility, mobile, and abandoned sessions.
```

---

# Prompt 8 — Reference and inspiration board

```text
Read all rules/specs. Inspect assets, storage paths, track details, focus mode, and workspace tabs.

Implement a structured reference board for audio references, external links, images, and notes. Reuse private assets where appropriate instead of duplicating file storage.

Database migration:
- Create migrations/007_track_references.sql.
- Create track_references:
  - id uuid primary key
  - track_id uuid not null
  - kind text not null: audio, image, link, note
  - title text not null
  - url text nullable
  - asset_id uuid nullable references assets(id) on delete set null
  - note text nullable
  - start_sec numeric nullable
  - end_sec numeric nullable
  - intent text nullable
  - sort int not null default 0
  - created_at and updated_at
- Add constraints so audio/image can reference an asset and link requires a valid URL at the application layer.
- Add indexes and owner RLS.
- Update schema.sql and types.

STOP for migration confirmation.

After confirmation, implement:

1. Reference board UI
   - Add References to the track work panel and make it available in focus mode.
   - Display a flexible ordered board/list of reference cards.
   - Support add, edit, reorder, duplicate, and delete.
   - Kinds:
     - Audio: upload or select an existing Reference asset
     - Image: upload or select an existing image/artwork asset
     - Link: external URL with title and note
     - Note: text-only concept card

2. Musical intent
   - Every reference may include a plain-language intent such as “match the vocal intimacy, not the drums.”
   - Audio references may include a start and end timestamp for the relevant section.
   - Validate that end is greater than start and clamp playback safely.

3. Playback
   - Reference audio uses the existing private storage abstraction and signed URLs.
   - Provide play/pause and timestamp-region playback without creating a second uncontrolled global audio stream.
   - Starting a reference pauses the main version player, and vice versa.
   - Create a small shared playback coordinator instead of brittle cross-component DOM access.

4. External links
   - Normalize and validate http/https URLs.
   - Open in a new tab with safe rel attributes.
   - Never auto-fetch metadata from arbitrary URLs in this package.

5. Visual behavior
   - Images use restrained thumbnails and do not overwhelm the workspace.
   - Provide compact and expanded views.
   - Avoid a Pinterest-like aesthetic; this remains a studio utility.

6. Focus integration
   - User can choose a subset of references when starting a focus session.
   - Focus mode shows only selected references by default with an option to reveal all.

7. Edge cases
   - Deleting an asset used by a reference leaves the reference record with a clear missing-file state.
   - Deleting a reference does not automatically delete the underlying shared asset; offer a separate cleanup choice only when no other record uses it.

Update all docs and versions. Run npm run build.

Return a manual checklist for each reference kind, audio coordination, timestamp regions, broken assets, URL validation, reorder, focus-mode selection, and mobile.
```

---

# Prompt 9 — Release workspace

```text
Read all rules/specs. Inspect Projects, project attachments, tasks, checklists, tracks, assets, deadlines, and current Release Prep template.

Implement a dedicated release workspace on top of Projects. Preserve generic projects and do not force every project to become a release.

Database migration:
- Create migrations/008_release_workspace.sql.
- Extend projects with project_type text not null default 'general' allowing general, single, ep, album, edit_pack.
- Create release_details:
  - project_id uuid primary key
  - release_date date nullable
  - label_name text nullable
  - distributor text nullable
  - catalog_number text nullable
  - upc text nullable
  - pre_save_url text nullable
  - live_url text nullable
  - pitching_deadline date nullable
  - submitted_at timestamptz nullable
  - timezone text nullable
  - created_at and updated_at
- Create release_track_metadata:
  - id uuid primary key
  - project_id uuid not null
  - track_id uuid not null
  - track_number int nullable
  - version_title text nullable
  - isrc text nullable
  - explicit boolean not null default false
  - primary_artist text nullable
  - featured_artists text[] not null default '{}'
  - writers text[] not null default '{}'
  - producers text[] not null default '{}'
  - mix_engineer text nullable
  - mastering_engineer text nullable
  - unique(project_id, track_id)
- Add indexes, owner RLS, and non-destructive constraints.
- Update schema.sql and types.

STOP for migration confirmation.

After confirmation, implement:

1. Project creation
   - Allow choosing General, Single, EP, Album, or Edit pack.
   - Existing projects remain General.
   - Release-specific fields appear only for release project types.

2. Release overview
   - Create a release workspace view with:
     - release date/countdown
     - readiness summary
     - attached track order
     - master/artwork status
     - metadata completion
     - distribution status
     - pitching deadline
     - upcoming tasks
   - Readiness must be transparent and based on explicit required fields/checklist/tasks, not an unexplained percentage.

3. Timeline
   - Build a vertical timeline using the release date, pitching deadline, task due dates, and key status events.
   - Allow shifting an incomplete future schedule when the release date changes, but show a preview and never move completed tasks.
   - User chooses which suggested task dates to update.

4. Metadata and credits
   - Provide an editor per attached track.
   - Validate obvious formats gently without blocking unknown workflows.
   - Do not invent ISRC or UPC values.
   - Add copy/export actions for a clean text summary and CSV generated in the browser without a new dependency.

5. Assets and approvals
   - Surface final master milestone and artwork asset.
   - Warn when the chosen master is not the current or approved version.
   - Reuse version decisions and milestones rather than creating duplicate approval concepts.

6. Suggested release plan
   - Offer an explicit “Create release plan” preview that can create checklist items/tasks for metadata, artwork, distribution, pitching, social, DJ outreach, and follow-up.
   - Avoid duplicates and let the user deselect actions.
   - This may reuse the stage-recipe execution utilities where sensible, but do not tightly couple project releases to a track stage.

7. Post-release
   - When a live URL and past release date exist, show a Post-release section for follow-up tasks and notes.
   - Do not add streaming analytics integrations in this package.

8. Mobile
   - Metadata tables become stacked editors.
   - Timeline and readiness remain readable without horizontal scrolling.

Update all docs and versions. Run npm run build.

Return a manual checklist for a General project, Single, multi-track EP, date changes, task preview, metadata export, master mismatch, mobile, and old project compatibility.
```

---

# Prompt 10 — Lightweight track collaboration, activity, and in-app notifications

```text
This is a high-risk permissions package. Read SECURITY-AND-PERMISSIONS.md, DATA-MODEL.md, every existing RLS policy, auth middleware, server helpers, and all track-child tables before changing anything.

Before writing SQL or code, produce a concise implementation plan in the Cursor chat showing:
- the exact permissions matrix
- every table whose RLS will change
- how owners retain full access
- how invitations are accepted
- how the app avoids exposing projects/tasks outside the invited track
Wait for user approval before continuing.

After approval, implement track-level collaboration.

Database migration:
- Create migrations/009_track_collaboration.sql.
- Create track_collaborators:
  - id uuid primary key
  - track_id uuid not null
  - user_id uuid nullable
  - invited_email text nullable
  - role text not null: editor, uploader, commenter, viewer
  - status text not null: pending, active, revoked
  - invited_by uuid not null
  - invite_token_hash text nullable unique
  - expires_at timestamptz nullable
  - accepted_at timestamptz nullable
  - created_at timestamptz not null default now()
- The owner remains tracks.user_id and is not duplicated as a collaborator row.
- Create activity_events:
  - id, track_id, actor_user_id nullable, actor_label nullable
  - event_type text
  - entity_type text nullable
  - entity_id uuid nullable
  - summary text not null
  - metadata jsonb not null default '{}'
  - created_at
- Create notifications:
  - id, user_id, track_id nullable, type, title, body, read_at, created_at
- Add helper SQL functions for role checks that avoid recursive RLS.
- Update RLS on tracks, versions, assets, checklist_items, sessions, comments, feedback, references, decisions, guest links, and stage recipe visibility according to the approved matrix.
- Collaborators must not gain access to unrelated projects, tasks, spaces, or other tracks merely because the invited track references them.
- Editors: edit track metadata/workflow/checklists/comments/references and upload versions/assets.
- Uploaders: read track and upload versions/assets, but cannot alter workflow, delete track, manage links, or invite people.
- Commenters: read track/version playback and create comments; can edit/delete only their own unresolved comments.
- Viewers: read-only playback and visible track workspace data approved by the matrix.
- Only owner can delete track, manage guest links, manage collaborators, configure recipes, or change ownership.
- Update schema.sql and types.

STOP for migration confirmation and require the user to test on a non-production account/track first.

After confirmation, implement:

1. Invitations
   - Owner invites by email and role.
   - Generate/store only a hashed invite token.
   - Invite link requires sign-in or account creation, then verifies that the signed-in email matches invited_email before acceptance.
   - Do not add an email provider. Provide Copy invite link.
   - Owner can change role, revoke, and resend/replace an invite.

2. Collaborator UI
   - Add People to the track work panel.
   - Show owner and collaborators with role/status.
   - Display small presence-like avatars only as identity indicators; do not claim real-time online presence.

3. Permission-aware interface
   - Hide or disable controls the current user cannot use, with brief explanations.
   - Server/database permission remains authoritative.
   - Never rely on client-side hiding for security.

4. Activity history
   - Record meaningful events: version upload/current change/pin, comment, decision, workflow update, stage transition, recipe run, focus session completion, collaborator change, guest-link creation/revocation.
   - Avoid logging every keystroke/autosave.
   - Add a filterable activity panel with human-readable summaries.

5. In-app notifications
   - Notify relevant signed-in collaborators for assignment, reply, decision, new version, and invitation acceptance.
   - Add a compact notification center in the app shell with unread count, mark read, and deep links.
   - No email, push, or background worker.

6. Attribution
   - Version, comments, decisions, sessions, and relevant activity show actor attribution when available.
   - Preserve readability for old rows with no actor.

7. Security verification
   - Add a developer-only permission test checklist or script using two test accounts and one unauthorized account.
   - Verify direct Supabase queries fail correctly for every role.
   - Verify a collaborator cannot enumerate other tracks by ids.

Update all docs and versions. Run npm run build.

Return a detailed manual RLS matrix test checklist. Treat any unauthorized access as a release blocker.
```

---

# Prompt 11 — Workspace layout presets and module ordering

```text
Read all rules/specs. Inspect the redesigned track workspace, work panel, focus mode, collaboration permissions, and local active-space preferences.

Implement bounded workspace customization. Do not build an arbitrary draggable grid or allow users to make the page unusable.

Database migration:
- Create migrations/010_workspace_preferences.sql.
- Create user_track_workspace_preferences:
  - id uuid primary key
  - user_id uuid not null
  - track_id uuid nullable
  - stage_id uuid nullable
  - preset text not null: writing, production, feedback, mix_review, release_prep, custom
  - module_order text[] not null
  - hidden_modules text[] not null default '{}'
  - default_panel text nullable
  - compact_mode boolean not null default false
  - updated_at timestamptz not null default now()
- Add a constraint preventing both track_id and stage_id being set together if that conflicts with the chosen precedence model.
- Use a unique index matching the precedence model.
- Owner/collaborator preferences are private per user; one user’s layout must not alter another user’s view.
- Update schema.sql and types.

STOP for migration confirmation.

After confirmation, implement:

1. Presets
   - Writing: waveform, references, notes, checklist
   - Production: waveform, versions, checklist, assets
   - Feedback: waveform, comments, decisions, versions
   - Mix review: waveform, A/B, references, comments, decisions
   - Release prep: milestone/master, release link, files, checklist
   - Presets change ordering and default panel only; they do not hide data permanently.

2. Preference precedence
   - Define and implement a predictable order, for example:
     - track-specific user preference
     - stage-specific user preference
     - last selected global preset
     - Production default
   - Document it.

3. Customization UI
   - Add “Customize workspace.”
   - Choose preset, reorder allowed modules, toggle optional modules, choose default work-panel tab, and compact mode.
   - Provide Reset to preset and Reset all.
   - Use keyboard-accessible reorder controls in addition to drag-and-drop.

4. Guardrails
   - Waveform/primary player cannot be hidden when a version exists.
   - Essential destructive controls remain reachable in Details/overflow regardless of layout.
   - If a module is unavailable due to permissions or missing feature data, collapse it gracefully without corrupting preferences.

5. Persistence and collaboration
   - Save per user, not per track owner.
   - Guests do not receive customization.
   - Permission changes immediately remove inaccessible modules from rendering while keeping stored preference safely.

6. Mobile
   - Presets affect section order, but mobile remains a linear layout.
   - Do not implement resizable columns on touch devices.

Update all docs and versions. Run npm run build.

Return a manual checklist for each preset, track/stage precedence, keyboard reorder, permission changes, reset, mobile, and preference isolation between two users.
```

---

# Prompt 12 — Today and Board command-center integration and final design polish

```text
Read all rules/specs and audit every feature implemented in Prompts 1–11. This package integrates the system and performs a final cohesive design pass. Do not invent new major data models.

Goals:
- Today answers “What deserves my attention and what should I do next?”
- Board answers “Where is every track and what is holding it up?”
- The product feels like one coherent studio operating system rather than a collection of appended features.

Implement:

1. Today priority queue
   - Replace the basic In motion ordering with a transparent priority queue derived from existing attention signals.
   - Each row states the reason it is surfaced: blocked, waiting, next move overdue, feedback unresolved, approval needed, inactive, or release deadline.
   - Provide one immediate action per row, such as Open comments, Set next move, Review version, Resume session, or Open release.
   - Never display a numeric productivity score.

2. Today sections
   - Keep tasks due, but avoid duplicating the same action across tasks and track signals.
   - Add:
     - Continue: active focus session or most recent unfinished work
     - Waiting: tracks waiting on a person/decision
     - Review: unresolved comments or decisions needed
     - Releases: upcoming release milestones
   - Collapse empty sections rather than filling the page with empty cards.

3. Board density and filters
   - Add filters for attention state, collaborator, next-action due state, and project/release.
   - Track cards show only the highest-value information for the selected density: title, stage context, next move, strongest signal, collaborator/waiting state, deadline.
   - Add Compact and Comfortable density choices saved locally or in user preferences.
   - Preserve drag performance and optimistic stage moves.

4. Quick actions
   - Create a single consistent command menu or Add menu for Track, Task, Focus session, Project/release, and Review link where context allows.
   - Do not add a dependency for command search unless explicitly approved.
   - Include keyboard shortcuts only when they do not conflict with typing in forms.

5. Cross-feature navigation
   - Deep links correctly open the relevant track, selected version, comment, panel tab, release section, or activity event.
   - Browser back/forward preserves meaningful selection state.
   - Notifications and Today actions land users at the exact work item.

6. Design coherence
   - Audit border/card density across Today, Board, track, projects, tasks, settings, and public review.
   - Use the Spectra shader only in the already approved atmospheric moments.
   - Keep ice as interaction and amber as state/emphasis.
   - Standardize section headers, counters, empty states, toasts, confirmation language, and loading skeletons.
   - Remove visual clutter and duplicate labels introduced across incremental packages.

7. Accessibility
   - Full keyboard pass across all new controls.
   - Accessible names for icon buttons and waveform markers.
   - Status never conveyed by color alone.
   - Respect reduced motion.
   - Check focus restoration after dialogs and drawers.

8. Performance
   - Avoid loading every comments/activity/reference row on Board or Today.
   - Add focused aggregate queries or database views/RPCs only if needed, through a new non-destructive migration named migrations/011_dashboard_aggregates.sql.
   - Paginate or progressively load activity and notifications.
   - Ensure signed URLs are requested only when audio is actually needed.
   - Audit unnecessary duplicate React Query requests.

9. Regression and cleanup
   - Remove dead components only after confirming they are unused.
   - Do not rewrite working features merely for stylistic preference.
   - Fix TypeScript, hydration, stale-query, mobile overflow, and permission-aware rendering issues discovered during the integration pass.

Update every living specification so it matches the final architecture. PRODUCT.md must describe only features actually implemented. Add a comprehensive plain-English CHANGELOG entry, bump package.json and lib/version.ts, and run npm run build.

Return:
- a feature-by-feature regression checklist
- a role-by-role permission checklist
- a mobile/PWA checklist
- any remaining technical debt ranked by risk
- the live URL verification sequence after deployment
```

---

# Optional Prompt 13 — Automated test foundation after the features stabilize

```text
Read TESTING-STRATEGY.md and inspect the final codebase. Do not add dependencies until you first propose the smallest appropriate test stack and receive approval.

Provide a short recommendation for:
- unit tests for pure attention-signal, pruning, token, permission, and recipe-validation utilities
- component tests for workflow forms and comment interactions
- end-to-end tests for auth, upload, guest review, stage recipes, focus sessions, collaboration RLS, and release workspace

Explain dependency cost, CI impact, and what can run without real production Supabase data. Wait for approval.

After approval, add the approved test foundation, isolated test configuration, fixtures, and a small high-value first suite. Never point tests at the live production database. Add scripts to package.json, document local/CI usage, update CHANGELOG.md and the version files, and run the full build plus tests.
```

---

# Prompt 14 — Social layer, phase 2: people directory, follow graph, and the Social page

```text
Context — read before doing anything, in this order:
- .cursorrules and CLAUDE.md
- PRODUCT.md and CHANGELOG.md (the entries dated 2026-07-30, versions 0.49.0–0.50.1)
- migrations/028_artist_profiles.sql — the artist_profiles table, its security
  kernel (my_profile_ids, owns_profile, profile_is_readable, notify_profile_owner),
  and the RLS pattern (every social policy is `to authenticated`; no table this
  layer creates gets an `anon` policy)
- lib/types.ts (ArtistProfile, ArtistProfileUpdate, ProfileVisibility, ProfileLink)
- lib/api/artist-profile.ts and hooks/use-artist-profile.ts
- app/(app)/artist/page.tsx, app/(app)/artist/[handle]/page.tsx
- app/p/[handle]/page.tsx, app/p/[handle]/public-profile-view.tsx,
  app/api/p/[handle]/route.ts, lib/public-profile-server.ts — the anonymous
  public-link pattern: a service-role route, never an anon RLS policy
- lib/supabase/middleware.ts — the `/p` and `/api/p` public-route allowlist
- components/app-shell.tsx — Artist / Social / Stats are already in the rail;
  app/(app)/social/page.tsx is currently a placeholder ("Social is on its way")

This is phase 2 of the social layer (phase 1 — artist profiles — is already
shipped). Do not touch artists, artist_profiles, or any table's existing RLS
policy. Every new table below is additive, in a new migration numbered 029.

Standing rules established in phase 1 — keep following them:
- No policy on a table that existed before this migration may be altered.
- Every social-table policy is `to authenticated`. Anonymous access, if ever
  needed, is a server route with the service-role client, never an anon
  policy — see lib/public-profile-server.ts for the pattern.
- Any subquery inside a policy or trigger that must see rows the caller
  doesn't own goes through a `security definer` helper function (`stable`,
  `set search_path = public`, ID-only arguments, returns a boolean or the
  caller's own rows, revoked from `anon`/`public`). An RLS-filtered subquery
  inside a policy silently evaluates to "no rows" rather than raising — that
  turns a guard into a no-op, so never rely on one directly.
- Any view over an RLS-protected table must carry `with (security_invoker = on)`
  — a default view runs as its owner and bypasses RLS entirely.

How to run this session: do the whole thing below in one continuous pass —
don't stop and wait for a new prompt between the migration, the API/hooks
layer, the Social page, and the orbit component. Work through the numbered
steps in order, and after each one, check it before moving to the next:
run `npx tsc --noEmit`, and where the step touches something renderable,
load it in the browser and look at it yourself rather than assuming it
works. If a check fails, fix it and re-check — don't carry a known-broken
step forward into the next one. If you get stuck on the same failure after
a couple of honest attempts (migration won't apply cleanly, an RLS policy
you can't get to behave, a rendering bug you can't isolate), stop where you
are, describe exactly what's broken and what you already tried, and ask me
what to do before guessing further or pushing anything uncertain. Don't
push to main until every step's checks pass and `npm run build` is clean.

Implement, in migrations/029_people_and_follows.sql:

1. People directory — a private CRM, NOT a shared graph. `people` is
   strictly `user_id = auth.uid()`; two accounts that both know the same
   collaborator get two independent rows. Columns: display_name,
   linked_profile_id (nullable FK to artist_profiles — resolves to a real
   TEMPO artist), linked_user_id, primary_email, roles text[], tags text[],
   notes, avatar_url, source (manual|collaborator|guest_review|
   release_credit|import), is_archived, last_interaction_at. Add
   `person_identities` (every email/handle/credit string ever seen for a
   person, with a normalized value for dedup, unique on
   (user_id, kind, value_norm)) and `person_appearances` (provenance:
   which track/project, what role, when — so the UI can say "credited as
   producer on 3 tracks"). Both scoped to user_id = auth.uid(), same as
   people.

2. Auto-seeding — write a `upsert_person(...)` security-definer
   find-or-create function plus a one-time transactional backfill at the
   tail of the migration, then AFTER INSERT triggers to keep it current
   going forward. Sources, in order: track_collaborators.invited_email,
   comments.guest_name where guest_link_id is not null, and
   release_track_metadata's featured_artists/writers/producers arrays plus
   its scalar credit columns (primary_artist, mix_engineer,
   mastering_engineer) — unnested and joined back through the owning
   project for tenancy. Do NOT rewrite release_track_metadata's free-text
   columns — they stay the source of truth; the seeder only reads them.
   Add nullable person_id columns (FK, on delete set null) to
   track_collaborators, comments, and guest_review_links so future rows
   link automatically. artists gets no new columns.

   Check before continuing: apply the migration against Supabase, then
   query `people`/`person_identities`/`person_appearances` directly and
   confirm every existing collaborator email, guest name, and release
   credit string shows up exactly once, and that re-running the backfill
   doesn't duplicate anything.

3. Follow graph — `profile_follows` (follower_profile_id,
   followee_profile_id, primary key on the pair, both directions indexed)
   and `profile_blocks`. Do NOT store a separate "connection" concept as a
   table — a mutual follow is fully derivable, so add it as a view
   `profile_connections` (self-join of profile_follows) with
   `security_invoker = on`. The block check inside the follow INSERT policy
   must go through a security-definer `is_blocked_between(a, b)` helper, not
   an inline subquery over profile_blocks (see the standing rule above for
   why). `create or replace` profile_is_readable (from migration 028) to
   additionally exclude blocked profiles — note in a comment that this
   replacement is not a no-op, since it changes behavior on an existing
   function other tables' policies already depend on.

   Check before continuing: with two Supabase accounts (or two rows you
   create by hand), confirm account B can follow account A's published
   profile, a block removes both directions from each other's follow
   reads, and profile_connections only ever returns mutual follows.

4. The Social page (app/(app)/social/page.tsx, replacing the placeholder):
   - Your network: the people directory as a filterable grid/list (by
     role/tag/source), showing which entries resolve to a linked TEMPO
     profile. A row for a linked person opens /artist/[handle]; otherwise a
     contact detail sheet.
   - Discover: search over published artist_profiles (visibility in
     ('members','public')) by display_name using the pg_trgm index already
     created in migration 028.
   - Follow/follower lists, with a working Follow/Unfollow button on
     /artist/[handle] (currently disabled there — wire it up).
   - The network orbit at the bottom of the page — see below.

   Check before continuing: load /social in the browser signed in as an
   account with at least one seeded person and one followed profile.
   Confirm the network grid, discover search, and follow/unfollow all
   actually work against real data, not just that the page renders empty.

5. The orbit constellation — components/social/network-orbit.tsx, built
   from scratch with Spectra tokens, NOT copied from any external component
   library. Three concentric rings, bottom-anchored, alternating CW/CCW
   rotation at different durations, icons counter-rotating to stay upright.
   Nodes are artist emblems drawn from the network (linked profiles first,
   then unresolved contacts) via SignedImage, falling back to
   components/artists/artist-mark.tsx's initials treatment. On hover: slow
   the rotation via a CSS custom property multiplier (ease, don't hard-stop),
   lift the hovered node, stop its own counter-rotation, and pop a
   SpotlightCard-based card (name, roles, how you know them). Click routes to
   /artist/[handle] or the contact sheet. Center: an LfWindow punched through
   to the existing Lightfield canvas (components/lightfield.tsx) with the
   active artist's emblem over it — do not add a new WebGL context or any
   new dependency (framer-motion is used in exactly one file today; this
   should not become the second — use CSS keyframes). Respect
   prefers-reduced-motion (static angles, hover still works) and pause via
   IntersectionObserver when offscreen. Use arbitrary Tailwind sizes
   (w-[27.5rem], not w-110 — this is Tailwind v3, not v4).

   Check before continuing: in the browser, hover a node (rotation eases
   down and the card pops), click through to a profile, resize to mobile
   width (no horizontal overflow), and toggle reduced-motion in devtools
   (rings go static, hover still works).

Do not implement the feed or messaging yet — those are phases 3 and 4.

Required on every push per .cursorrules: bump APP_VERSION in lib/version.ts
and version in package.json together (minor bump — this is a real feature),
add a plain-English CHANGELOG.md entry under today's date noting migration
029 needs to run (it applies automatically via
.github/workflows/supabase-migrations.yml on push to main — no manual step),
and update PRODUCT.md's Social paragraph to describe what actually shipped
instead of "Social is on its way". Run npx tsc --noEmit and npm run build
clean before considering this done.

Return:
- the exact RLS policies you wrote for people, profile_follows, and
  profile_blocks, so they can be reviewed against the standing rules above
- a two-account test plan: what account B should and should not be able to
  see/do against account A's people, follows, and profile
- a screenshot-driven walkthrough of the Social page and the orbit's hover
  behavior
```

---

## How to use this pack

1. Start with Prompt 0 and review the generated specifications.
2. Run one implementation prompt at a time.
3. When Cursor creates a migration, run that exact file in Supabase and confirm success before telling Cursor to continue.
4. Manually test the work package before moving on.
5. Commit after each successful package so any regression can be isolated or rolled back.
6. Do not let Cursor combine collaboration/RLS work with unrelated visual refactors.
