# TEMPO — Feature Specifications

*Living document. Describes planned next-generation features. Does not claim these exist in the product yet unless a later work package ships them and PRODUCT.md is updated.*

**Status key:** Planned · Spec only (Prompt 0) · Implemented (update when shipped)

## Current shipped initiative — Team Operations

**Status:** Specification complete; implementation not started.

The Prompt 0–12 feature sequence below describes the foundation that has since shipped. The next coordinated feature initiative is Team Operations: permission truth, informed membership lifecycle, assignments and a private cross-artist My Work queue, review requests, an Artist Team Brief, one private team room per artist, a multi-artist Pro operating home, and optional role-based starter kits that personalize a Pro's private workspace without changing artist access.

The binding specification suite is:

- `TEAM-OPERATIONS-PRODUCT-SPEC.md`
- `TEAM-OPERATIONS-UX-SPEC.md`
- `TEAM-OPERATIONS-TECHNICAL-DESIGN.md`
- `TEAM-OPERATIONS-SECURITY-AND-PERMISSIONS.md`
- `TEAM-OPERATIONS-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md`

Team Operations is implemented in migrations 101–105 and the shared web client. Production rollout still follows the package order and direct hosted RLS gates in the implementation plan. Logical migration labels in the original design suite map to the numbered additive migrations.

**Product defaults (binding):**
- Guest reviewers do not need an account.
- Guest links are tied to one fixed version, expire after 14 days by default, and can be revoked anytime.
- Guest downloads are disabled by default.
- Stage recipes preview before running by default; automatic mode is explicit per recipe.
- Pinned milestone versions are exempt from the two-version pruning rule; TEMPO still keeps only the two newest unpinned versions.
- Focus sessions include a timer; database timestamps are the source of truth.
- First notification system is in-app only — no email provider yet.
- Collaboration begins at the track level, not a full team workspace.
- Workspace customization uses bounded presets and module ordering, not a freeform dashboard builder.
- No fake AI — any intelligence must be explainable from real TEMPO data.

---

## 1. Redesigned track workspace

**Status:** Implemented (v0.7.0)

### User problem
The track page currently feels like a stack of equally weighted admin cards. Artists need a focused studio workspace where listening and version work dominate, with supporting tools in a clear secondary panel.

### Primary flows
1. Open `/track/[id]` from Board, Tracks, or Today.
2. See identity header (artwork, title, meta, stage, momentum, deadline) with restrained artwork-derived ambient tint.
3. Use stage timeline to move the track (confirm only when skipping more than one stage).
4. Play the selected bounce; manage versions below; log sessions in the main column.
5. Use sticky work panel tabs: Work (checklist), Files (assets/artwork), Notes, Details.
6. Deep-link panel via `?panel=files` (default Work).

### Empty / loading / error
- Skeleton matches new regions (header, timeline, player, panel).
- No versions: player empty state invites upload; workspace remains usable.
- Stages fail to load: inline warning; rest of workspace usable.
- Artwork tint extraction fails: silent deterministic fallback from track id.

### Permissions
Owner only in v1 (pre-collaboration). Later roles follow SECURITY-AND-PERMISSIONS.md.

### Mobile
Timeline scrolls horizontally with current stage in view. Work panel becomes a horizontally scrollable segmented control in document flow (not sticky overlay). Readable at 320px.

### Accessibility
Keyboard tabs with correct ARIA roles; stage timeline keyboard-reachable; visible ice focus rings; no hover-only essential controls; respect `prefers-reduced-motion`.

### Non-goals
No collaboration UI, comments, recipes, new DB tables, or full-page artwork backgrounds in this package.

---

## 2. Next move / blockers / waiting-on

**Status:** Implemented (v0.7.0) — pending migration 001 confirmation in production Supabase. Board/Today priority reordering by urgency (item 5) not yet done; card next-action line + top signal shipped.

### User problem
Artists lose the thread between sessions. “What am I doing next on this track?” and “What’s blocking me?” live in memory or scattered notes.

### Primary flows
1. Set next action (text), optional due date, blocked reason, and/or waiting-on from the Now/Next/Blocked strip or expanded editor.
2. Clearing a field saves empty → null.
3. Stage changes update `stage_entered_at` via DB trigger.
4. Board cards show a restrained next-action line and high-priority signals.
5. Today reorders In motion by explainable urgency and offers quick edit of next move.

### Empty / loading / error
- Empty strip shows short invitations (“What’s the next move?”) not blank labels.
- Inline save errors preserve typed text.
- Loading: strip skeleton or soft placeholders without layout jump.

### Permissions
Owner (later: editor can edit workflow; viewer read-only).

### Mobile
Strip wraps into a 2×2 grid. Signals use icon + text, not color alone.

### Accessibility
Editable fields labeled; severity announced in text; dialogs restore focus.

### Non-goals
Do not auto-create global tasks from next-action in this package. Do not invent opaque momentum scores.

---

## 3. Explainable momentum and attention signals

**Status:** Implemented on the track workspace (v0.7.0) — `deriveAttentionSignals` ships in `lib/attention/signals.ts` and is surfaced in the workflow strip. Board/Today consuming the same utility is not done yet (extended by Prompt 12).

### User problem
Manual momentum (Active / Simmering / Stalled / Parked) expresses artist intent, but does not surface overdue next moves, blocks, or inactivity. Opaque “AI scores” would erode trust.

### Primary flows
1. Pure utility derives structured signals from track facts + related counts/dates.
2. Each signal has `id`, `label`, `severity`, and human `explanation`.
3. Track workspace shows top 1–2 signals with expand-all.
4. Board/Today consume the same utility — never duplicate conflicting rules.

### Example signals
- no next move · next move overdue · deadline approaching · blocked · waiting on someone · no session in 7+ days · in current stage 14+ days · unresolved feedback (when comments exist)

### Empty / loading / error
No signals → quiet UI (no fake “all clear” score). Utility failures must not break the page.

### Permissions
Derived client/server from data the user can already read.

### Mobile / a11y
Severity not color-only; explanations readable in expand panels.

### Non-goals
No composite numeric productivity score. Manual momentum field remains separate artist intent.

---

## 4. Timestamped waveform comments

**Status:** Implemented (v0.8.0) — signed-in owner only, as scoped. Board/Today surfacing of the "unresolved feedback" signal beyond the track workspace strip is deferred to Prompt 12.

### User problem
Feedback lives in DMs and notes without a precise time on the bounce. Owners need comments pinned to the waveform for the selected version.

### Primary flows
1. Seek/pause → “Add comment here” (or click empty waveform position carefully without breaking seek/play).
2. Markers on waveform; list sorted by timestamp; resolved collapsible.
3. Click comment → seek; cross-version comment switches version first, then seeks when ready.
4. Create, edit own, reply, resolve/reopen, delete with confirm.
5. “All versions” filter groups by version without misleading markers on the current waveform.
6. Unresolved counts on work-panel tab and version rows; feed attention signals.

### Empty / loading / error
- No versions: explain that a bounce is needed first.
- Audio load failure: comments remain readable/editable; seek disabled with explanation.
- Dense markers: cluster visually; full access via list.

### Permissions
Signed-in users only in this package (owner; later roles per matrix). Guests in Prompt 4.

### Mobile
Marker tap opens panel/drawer; pixel-perfect click not required.

### Accessibility
Markers keyboard-reachable; expose timestamp, author, status, text to AT.

### Non-goals
Guest links, collaborator roles, email notifications.

---

## 5. Guest feedback links

**Status:** Implemented (v0.9.0)

### User problem
Artists need outsiders to hear a specific bounce and leave timestamped notes without creating accounts.

### Primary flows
1. Owner creates link on a fixed version (default 14-day expiry; comments on; download off).
2. Raw token shown once; only SHA-256 hash stored.
3. Guest opens `/review/[token]` — branded focused page: title, artwork, version label/no, changelog, waveform, comments.
4. Guest posts comment (name + text + timestamp) via server routes; cannot edit/resolve/reply/delete.
5. Owner sees guest comments in the normal panel; can resolve/delete; revoke link without deleting received comments.

### Empty / loading / error
Invalid / expired / revoked → generic unavailable state (no leak). Abuse burst → calm retry message.

### Permissions
Guests: playback of that version + optional comments/download per link flags. Never see private notes, tasks, other versions, owner email, projects.

### Mobile
Focused single-column review page; large play control.

### Accessibility
noindex; restrictive referrer; keyboard play/comment; form labels.

### Non-goals
Public audio bucket; email invites; guest resolve/edit; arbitrary version id in client requests.

---

## 6. Version milestones

**Status:** Planned (Prompt 5)

### User problem
Keeping only two bounces loses meaningful historical locks (vocal comp, mix approved, master). Unlimited storage is out of scope.

### Primary flows
1. Pin a version with milestone type (demo, vocal_comp, arrangement_lock, mix_approved, master, custom) + optional label.
2. Pruning: keep all pinned + two newest unpinned; never prune current; deterministic after successful upload.
3. Unpin confirms if the version becomes eligible for pruning.
4. Timeline UI surfaces milestones clearly.

### Empty / loading / error
Upload/prune errors must not delete the new successful upload unexpectedly.

### Permissions
Owner (later: editor upload; pin rules TBD — default owner/editor).

### Mobile
Compact vertical timeline.

### Accessibility
Pinned state announced; confirm dialogs describe consequences.

### Non-goals
Unlimited version history; changing `file_url` on existing rows.

---

## 7. Version decisions and approvals

**Status:** Planned (Prompt 5)

### User problem
“Is this mix approved?” needs an append-only record, not a overwritten checkbox.

### Primary flows
1. Record decision: Approved / Needs changes / Rejected + area + note.
2. Latest-state summary + full decision log.
3. New versions do not auto-invalidate prior approvals; UI shows approval belongs to an older version.
4. Blind A/B may optionally record a decision after reveal.

### Empty / loading / error
No decisions → invite to record. Failed save preserves form.

### Permissions
Owner/editor in app; guest decision submission deferred (schema nullable for future).

### Non-goals
Silent overwrite of prior decisions; duplicate approval concepts in release workspace.

---

## 8. Blind A/B comparison

**Status:** Planned (Prompt 5)

### User problem
Seeing version numbers and dates biases listening. Artists need a fair A/B of two bounces.

### Primary flows
1. Pick two versions → enter blind mode (A/B labels; mapping randomized per session in component state).
2. Sync seek as closely as WaveSurfer allows; independent volume; one-at-a-time playback.
3. Choose A, B, no preference, or leave without recording.
4. Reveal → optional version decision.

### Empty / loading / error
Need ≥2 playable versions. Load failure on one side explained without claiming sync.

### Permissions
Anyone who can play both versions.

### Mobile
Stacked A/B controls; no overlapping playback.

### Accessibility
Announce A/B without revealing identity until reveal; keyboard transport.

### Non-goals
Sample-perfect sync claims; automatic decision without user choice.

---

## 9. Stage recipes

**Status:** Planned (Prompt 6)

### User problem
Entering Mixdown or Release Prep often means the same checklist/tasks/next-action setup. Artists want optional automation without surprise.

### Primary flows
1. Per-stage recipe: enabled, preview|automatic, ordered actions.
2. Actions v1: apply_checklist_template, create_task, set_next_action, set_momentum, request_version_decision (task/prompt only).
3. Any stage change path (Board drag, timeline, dropdown) goes through one transition helper with unique `transition_key`.
4. Preview: dialog, deselect actions, Apply or Skip (stage change stays).
5. Automatic: toast + Undo when safe.
6. Explicit “Add suggested recipes” for matching stage names — never silent seed for existing users.

### Empty / loading / error
Partial failure records per-action results; retry only failed/unapplied. Duplicate checklist items skipped with explanation.

### Permissions
Only owner configures recipes. Runs affect track data per role matrix later.

### Mobile
Preview dialog full-screen sheet; actions list scrollable.

### Non-goals
Background jobs, email, running recipes on page load.

---

## 10. Focus sessions

**Status:** Planned (Prompt 7)

### User problem
Session log is retrospective. Artists need an intentional focus mode: goal → work → close the loop.

### Primary flows
1. Start from track or Today: goal + optional checklist items; create active session server-side first.
2. Conflict: Resume or End existing active session (partial unique index per user).
3. `/track/[id]/focus` reduced shell: identity, goal, timer, waveform, checklist subset, scratch notes, references, End.
4. Timer from `started_at` (DB authoritative); survives refresh; elapsed computed once on end.
5. End: what changed / left / next move / optional bounce upload; optional next_action update with confirm.
6. Abandon without summary; recover sessions older than 24h.
7. Session log upgraded; Today weekly time summary (non-judgmental).

### Empty / loading / error
Clock anomalies handled defensively. Unsaved scratch warns on leave.

### Permissions
Owner (later collaborator rules per matrix). Guests: no focus mode.

### Mobile / PWA
End reachable; no unsupported wake locks without asking.

### Non-goals
Background timers, productivity shame metrics, email reminders.

---

## 11. Reference and inspiration board

**Status:** Planned (Prompt 8)

### User problem
References live as loose assets or browser tabs. Artists need structured audio/image/link/note cards with musical intent.

### Primary flows
1. Work panel References + focus mode access.
2. Kinds: audio, image, link, note — ordered board; add/edit/reorder/duplicate/delete.
3. Intent text; audio start/end region; coordinated playback with main player.
4. Links: http(s) only; new tab; safe `rel`; no auto metadata fetch.
5. Deleting asset → missing-file state on reference; deleting reference does not auto-delete asset.

### Empty / loading / error
Empty board invite. Broken asset clear state. Invalid URL blocked with message.

### Permissions
Per collaboration matrix (editors manage; viewers read).

### Mobile
Compact/expanded cards; linear list.

### Non-goals
Pinterest aesthetics; scraping arbitrary URLs; second uncontrolled global audio stream.

---

## 12. Release workspace

**Status:** Planned (Prompt 9)

### User problem
Release prep is more than a track stage: dates, metadata, pitching, distribution, and multi-track order. Generic projects alone are underpowered for releases but must remain available.

### Primary flows
1. Project type: general | single | ep | album | edit_pack (existing → general).
2. Release overview: date/countdown, transparent readiness, track order, master/artwork, metadata completion, distribution, pitching, tasks.
3. Timeline with optional date-shift preview (never move completed tasks).
4. Per-track metadata/credits; soft validation; copy/export text + CSV in browser.
5. Surface milestone/master and version decisions; warn on master mismatch.
6. Explicit “Create release plan” preview.
7. Post-release section when live URL + past date.

### Empty / loading / error
General projects unchanged. Incomplete readiness lists missing items explicitly.

### Permissions
Project owner (collaboration on projects out of scope for track-level invites).

### Mobile
Stacked metadata editors; no horizontal-scroll tables.

### Non-goals
Streaming analytics; inventing ISRC/UPC; forcing all projects to be releases.

---

## 13. Lightweight track collaboration

**Status:** Planned (Prompt 10 — high risk)

### User problem
Solo ownership works until a mixer, vocalist, or friend needs limited access to one track — not the whole catalog.

### Primary flows
1. Owner includes a TEMPO artist (people they follow, or anyone by handle) as a collaborator, or invites by email + role (editor, uploader, commenter, viewer); hashed invite token for email; copy link (no email provider).
2. Invitee signs in; email must match; accept → active.
3. Owner change role / revoke / replace invite.
4. UI hides/disables unauthorized controls; RLS is authoritative.
5. Collaborators must not enumerate other tracks or inherit projects/tasks/spaces.

### Empty / loading / error
Pending invites listed. Unauthorized → calm denial, no data leak.

### Permissions
Full matrix in SECURITY-AND-PERMISSIONS.md. Owner not duplicated as collaborator row.

### Mobile
People panel in work tabs; invite flow single column.

### Non-goals
Team workspace conversion; org billing; real-time presence claims; email delivery.

---

## 14. Activity history and in-app notifications

**Status:** Planned (Prompt 10)

### User problem
Collaborators miss version uploads and decisions. Owners need a readable history without keystroke noise.

### Primary flows
1. Record meaningful events (upload, pin, comment, decision, workflow, stage, recipe, focus complete, collaborator, guest link).
2. Filterable activity panel with human summaries.
3. In-app notifications for assignment, reply, decision, new version, invite acceptance.
4. Shell notification center: unread count, mark read, deep links.

### Empty / loading / error
Empty activity invite. Paginate later (Prompt 12). No email/push.

### Permissions
Actors see events for tracks they can access. Notifications only for intended `user_id`.

### Non-goals
Email provider, push, background workers, logging every autosave.

---

## 15. Workspace layout presets

**Status:** Planned (Prompt 11)

### User problem
Writing vs mix review need different module emphasis. Freeform dashboard builders become unusable.

### Primary flows
1. Presets: writing, production, feedback, mix_review, release_prep, custom.
2. Precedence: track-specific → stage-specific → last global preset → Production default.
3. Customize: reorder allowed modules, toggle optional, default panel, compact mode; keyboard reorder; Reset.
4. Preferences per user (not track owner). Guests: no customization.
5. Waveform cannot be hidden when a version exists; destructive controls always reachable.

### Empty / loading / error
Unavailable modules collapse without corrupting stored prefs.

### Permissions
Private per user_id. Permission changes hide inaccessible modules immediately.

### Mobile
Affects section order only; linear layout; no resizable columns.

### Non-goals
Arbitrary grid builder; making the page unusable.

---

## 16. Today and Board prioritization

**Status:** Planned (Prompt 12)

### User problem
Today and Board must answer attention and status questions coherently after features land, not feel like bolted-on panels.

### Primary flows
1. Today priority queue with transparent reasons and one immediate action per row.
2. Sections: Continue, Waiting, Review, Releases (+ tasks due without duplicate actions).
3. Board filters (attention, collaborator, next-action due, project/release) + Compact/Comfortable density.
4. Consistent Add/command menu; deep links; design coherence pass.

### Empty / loading / error
Collapse empty sections. Aggregates only if needed via non-destructive migration.

### Permissions
Respect collaboration visibility; never load private data for unauthorized users.

### Mobile / a11y
Full keyboard pass; reduced motion; focus restoration after dialogs.

### Non-goals
Numeric productivity scores; new major data models; dependency for command search unless approved.

---

## Cross-cutting non-goals (all packages)
- Dropping/truncating/recreating production tables
- Making the `audio` bucket public
- Hardcoding secrets or localhost in shipped absolute URLs
- Fake AI features
- Email notification providers before an explicit decision
- Combining Prompt 10 RLS work with unrelated visual refactors
