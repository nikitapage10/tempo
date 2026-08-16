# TEMPO — Team Operations Implementation, Test, and Rollout Plan

*Status: Implementation complete in migrations 101–105 and the shared web client. Schema rollout and the direct hosted RLS matrix remain deployment gates.*

**Related:** `TEAM-OPERATIONS-PRODUCT-SPEC.md` · `TEAM-OPERATIONS-UX-SPEC.md` · `TEAM-OPERATIONS-TECHNICAL-DESIGN.md` · `TEAM-OPERATIONS-SECURITY-AND-PERMISSIONS.md` · `TESTING-STRATEGY.md`

---

## 1. Delivery rules

1. Sync and choose migration numbers only when each package is ready to implement.
2. Every migration is additive, rerunnable where the repository's deployment workflow requires it, and verified on an isolated Supabase project before production.
3. Never drop, truncate, recreate, or reset production data.
4. RLS/security packages receive direct database tests before UI relies on them.
5. Every package has its own version bump, CHANGELOG entry, PRODUCT update when behavior ships, typecheck, tests, build, and manual checklist.
6. Do not advertise a visible access control before its backend policy works.
7. Do not combine delegated Team Write or Social Write with the initial permission cleanup.
8. Cross-boundary Electron changes are not expected. If introduced, stop and apply the desktop release policy.
9. Rebase/sync at landing time and recompute version/document placement against fresh `origin/main` under the repository concurrency protocol.
10. A failed security matrix row blocks release even if the UI appears correct.

---

## 2. Feature gates

Use server-readable schema capability checks and small application feature flags rather than assuming all migrations deploy simultaneously.

Proposed gates:

```text
team_permission_contract
team_membership_lifecycle
team_work_assignments
team_brief
team_room
pro_operations_home
pro_role_starter_kits
```

Rules:

- Default off until migration and minimum client path are deployed.
- Gate UI entry points and mutations, not RLS.
- Older clients remain safe because new columns are nullable and old grants normalize.
- Gates may enable for platform-admin/test accounts first, then invited beta members, then everyone.
- Removing a gate requires all rollback and compatibility checks to pass.

---

## 3. Package sequence

### Package 0 — Documentation and test fixtures

**Outcome:** Approved product, UX, technical, security, and rollout contracts; isolated multi-account fixture plan.

Work:

- Review all five Team Operations documents.
- Resolve blocking decisions in §10.
- Add/update reusable non-production fixture helpers for Alpha, Beta, P, M, S, C, U, G, and Admin personas.
- Document how schema CI applies the next migration number.
- Confirm no feature copy is added to `PRODUCT.md` until behavior ships.

Gate:

- Product owner approves terminology, area vocabulary, access-preset defaults, assignment semantics, offboarding behavior, and starter-kit catalog/default mode.
- Security review approves the matrix before SQL.

### Package 1 — Permission truth

**Outcome:** Every Team access row is honest, normalized, and enforced end to end.

Work:

- Implement logical `TEAM-01-permission-contract` using next migration number.
- Add closed area keys: Catalog, Audio & files, Feedback, Tasks, Calendar, Releases, Stats, Performances, Social, Team.
- Define compatibility mapping for existing memberships.
- Add space/artist helper functions and complete member policies for Tasks, Releases, and any currently incomplete readable child surfaces approved for v1.
- Update roles/presets and normalized effective-access API.
- Replace unsupported Social Write and Team Write controls with Owner only.
- Update Team owner/member access UI and invitation summary primitives.
- Add direct RLS matrix tests.

Do not include:

- Assignments
- Suspension/revocation redesign
- Team Brief
- Team room

Verification:

- Existing manager/agent/tour manager/label/assistant rows preserve intended current access.
- Unknown area key write rejected.
- Missing key reads as none.
- Read versus write denies confirmed via direct Supabase calls.
- Owner access unchanged.

### Package 2 — Membership lifecycle and informed invitations

**Outcome:** Both sides understand access; members can be suspended, resumed, leave, or be ended safely.

Work:

- Implement logical `TEAM-02-membership-lifecycle`.
- Add invitation message, relationship label, lifecycle columns/events.
- Replace one-tap existing-member approval with invitation detail review.
- Add normalized access summary to email and in-app invite flows.
- Implement suspend/resume/leave/end RPCs without assignment handling initially; offboarding preview reports zero/new source counts safely.
- Add membership access/history sheet.
- Clear caches/exit workspace on access loss.
- Add grouped notifications.

Verification:

- Wrong user cannot accept invite.
- Invitee cannot alter grants on accept.
- Suspension blocks direct reads before UI redirect.
- Resume restores only stored grants.
- Leave/end removes room participation later via no-op-safe sync hook.
- Events are append-only and contain no disallowed content.

### Package 3 — Task assignments

**Outcome:** Artists and authorized Pros can assign existing tasks without duplicating them.

Work:

- Implement task portion of logical `TEAM-03-work-assignments`.
- Add assignment fields, history, indexes, validation RPCs, and Task policies.
- Add assignee picker/detail/history and task filters.
- Add artist Waiting surface for tasks.
- Add assignment notifications/dedupe.
- Extend offboarding preview/final transaction to task outcomes.
- Preserve safe offline status updates; keep assignment mutations online-only.

Verification:

- Only active eligible owner/member appears in picker.
- Direct assignment to ineligible UUID rejected.
- Read access alone cannot broadly edit a task.
- Assignee status-only RPC works as approved.
- Reassignment history is correct under concurrent clients.
- Offboarding cannot complete with unresolved task choices.

### Package 4 — My Work v1

**Outcome:** A Pro sees assigned tasks and existing assigned comments across artists in one private queue.

Work:

- Add My Work fan-in RPC for tasks/comments.
- Add My Work tab, filters, transparent urgency, deep-link context switching, pagination, and completed history.
- Add private cross-artist cache/query keys.
- Add partial-failure and offline-stale states.
- Keep existing Roster as a sibling tab.

Verification:

- Pro on Alpha+Beta sees only their own assigned rows from both.
- Alpha owner cannot query the combined result.
- Opening a Beta row switches artist/space then source.
- Browser Back restores queue filters/position.
- Unread notification and work row do not duplicate as two actions.

### Package 5 — Review requests

**Outcome:** Bounce, decision, comment, and release review handoffs share one explicit lifecycle.

Work:

- Complete logical `TEAM-03-work-assignments` with `review_requests`.
- Add request entry points and eligibility.
- Add kind-specific atomic completion RPCs.
- Add request rows to My Work and artist Waiting.
- Extend offboarding preview/reassignment.
- Add existing version/comment/decision/release cache invalidation.

Verification:

- Fixed version remains identified after a newer upload.
- Underlying-source permission required at request and completion.
- Completion writes result and closes request atomically.
- Cancellation/reassignment creates notifications and no duplicate open row.
- Deleted/unavailable target fails calmly without leaking.

### Package 6 — Artist Team Brief

**Outcome:** Newly joined and active team members have a safe orientation surface.

Work:

- Implement logical `TEAM-04-team-brief`.
- Add composed brief read, authored fields, links, pins, and private seen state.
- Make Team Brief first destination after new membership approval.
- Add Updated markers without owner-visible read receipts.
- Add link validation, pin source validation, reorder accessibility.

Verification:

- Member sees only sections/sources their grants permit.
- Pin never grants source access.
- Removing a pin does not alter source.
- Artist cannot query member seen state.
- Suspended member cannot fetch authored brief.

### Package 7 — Artist team room

**Outcome:** Each artist and active team coordinate in one private existing-message room as themselves.

Work:

- Implement logical `TEAM-05-team-room`.
- Add idempotent artist-room binding and participant sync.
- Extend Messages with Teams section and Team entry action.
- Add mentions, link-work picker/cards, pin categories, and limited system events.
- Reuse current search, reactions, voice/media, mute/archive, realtime, and pagination.
- Add participant drift repair/health check.

Verification:

- Exactly one room per artist under concurrent creation.
- Owner and active members participate; suspended/former do not.
- Human identity displayed on every message.
- Link snapshot contains no prohibited fields and opening reauthorizes.
- Unrelated user and track-only collaborator cannot subscribe/read.
- Existing DMs, Support, Scene chat, and notification behavior remain green.

### Package 8 — Pro operations home

**Outcome:** My Work, private combined schedule, Roster, availability, and notification preferences form one cross-artist home.

Work:

- Implement logical `TEAM-06-pro-operations`.
- Add availability and private per-artist preferences.
- Add private combined schedule RPC and agenda/week UI.
- Add factual conflict detection and artist context switching.
- Add per-artist notification levels.
- Show declared availability allowlist to shared artists only when opted in.

Verification:

- Private/personal and multi-artist rows coexist only for the Pro.
- No artist can query schedule/conflicts/preferences.
- Shared availability reveals only opted-in allowlist.
- Date timezone handling matches Calendar.
- Muting one artist does not mute access/security events or another artist.

### Package 8A — Role-based Pro starter kits

**Outcome:** A Pro may opt into a transparent, role-relevant starting point for their private workspace without changing artist access or overwriting existing work.

Work:

- Implement logical `TEAM-07-pro-starter-kits` after the Pro operations home is stable.
- Seed versioned Manager, Label / label owner, Publicist, Tour manager, Agent, Assistant, and Custom catalog definitions.
- Build first-open/Settings prompt, multi-role selection, primary home emphasis, literal preview, templates-only/default mode, optional private examples, and result summary.
- Add user-owned Pro-home preferences and saved views.
- Add transactional preview/install with server catalog validation, request idempotency, cross-kit semantic dedupe, receipts, and item provenance.
- Add restore-missing-defaults and remove-untouched-examples actions; never overwrite or delete edited targets.

Verification:

- Passage roles are suggestions only; Start blank and Remind me later remain usable.
- Every preview name/count matches the transaction result or appears under Skipped with a reason.
- Multi-role combinations dedupe shared content and preserve the chosen primary lens.
- Installation, retry, restore, and removal affect only the caller's personal workspace.
- Existing layouts and user-created records remain unchanged unless an explicit, itemized confirmation says otherwise.
- No role selection changes team membership, permissions, profile claims, or artist-owned work.
- Web, mobile, desktop shared-web, keyboard, reduced-motion, and offline failure states pass.

### Package 9 — Delegated Team/Social administration (separate future gate)

This package is intentionally not required to complete Team Operations 1.0.

Before Team Write:

- Approve non-escalation rules in the security document.
- Implement database enforcement preventing self-edit and grant amplification.
- Add owner audit/notifications and emergency revoke path.

Before Social Write:

- Design drafts, approvals, published-by attribution, rollback, and actor audit.
- Do not reuse artist post ownership in a way that hides the human actor.

Until then, both surfaces say Owner only.

---

## 4. Automated test plan

Use existing Vitest, Playwright, and integration RLS infrastructure. No new dependency is expected.

### Unit tests

| Area | Tests |
|---|---|
| Terminology/presets | Closed keys, role defaults, normalization, customized detection, unsupported-level display |
| Access summaries | Literal read/edit/none sentences from normalized grants |
| My Work | Urgency ordering, filtering, grouping, action selection, stable pagination tuple |
| Assignment | Eligibility mapping and optimistic rollback state |
| Offboarding | Plan validation and unresolved-source detection |
| Team Brief | Pin target shape, URL validation, version/Updated state |
| Availability | IANA/working-day validation and shared projection |
| Starter kits | Catalog validation, preview dedupe/counts, role combinations, idempotency, fingerprint/untouched detection |
| Notifications | Group-key/dedupe/suppression rules |
| Query keys | User/artist separation and account-switch clearing |

### Integration/RLS tests

Use the accounts in the Team security document.

- Every table policy and RPC allow/deny row
- Existing grant compatibility mapping
- Suspended/revoked transition in same JWT session
- Cross-artist My Work/schedule isolation
- Assignment/review source-access checks
- Offboarding transaction rollback on one invalid reassignment
- Team Brief source filtering and private seen rows
- Team-room participant/topic authorization
- Availability allowlisted sharing
- Starter-kit personal-workspace enforcement, catalog immutability, retry/concurrency idempotency, and forged target/payload denies
- Admin and guest non-access

### Component tests

- Invitation access review before approval
- Role-change keep-versus-reset choice
- Assignee picker eligibility and error restoration
- My Work primary actions and filters
- Offboarding sticky confirmation requirements
- Brief editor/reorder keyboard paths
- Room link card unavailable state
- Mobile permission/filters sheets
- Starter-kit role selection, exact preview, Start blank/remind paths, combined-kit result, and edited-example removal warning

### E2E tests

1. Invite existing Pro → inspect grants → approve → Brief → workspace.
2. Invite new Pro → account creation/Passage → same grant summary → Brief.
3. Artist assigns task → Pro sees My Work → completes → artist Waiting clears.
4. Request bounce review → Pro listens/decides → append-only decision linked.
5. Pro supports Alpha and Beta → private combined queue/schedule → no owner cross-read.
6. Suspend Pro while artist page open → next request denied → safe exit → room inaccessible.
7. End access with open work → reassign → membership/history/room all consistent.
8. Team room message/reply/mention/link → realtime round trip → revoke removes access.
9. Mobile invite, assignment, My Work, Brief, and room smoke.
10. Web and Electron shared-web smoke for access loss, messages, offline stale state, and deep links.
11. New Pro completes Passage → previews two role kits → installs templates → reloads without duplicates → adds a later kit.
12. Existing Pro opens Starter kits in Settings → installs optional samples → edits one → removal deletes only untouched examples.
13. Forged install targets an artist workspace/catalog key → transaction rejects everything and creates no receipt or partial content.

---

## 5. Manual two-artist matrix

### Setup

- Artist Alpha: Manager P has broad access; Assistant M has Tasks/Calendar Write only.
- Artist Beta: P has Catalog/Stats Read, no Tasks/Audio/Feedback.
- Personal Pro home: one private task and one event.
- Alpha: assigned task, review request, audio version, release, event, room.
- Beta: similarly named hidden rows to detect accidental leakage.

### Assertions

- [ ] P My Work contains Alpha assigned work, not Beta ungranted work.
- [ ] P combined schedule contains readable Alpha/Beta dates plus personal dates.
- [ ] Alpha sees only Alpha work assigned to P.
- [ ] Alpha never sees Beta name/date through conflict messaging.
- [ ] M cannot open Alpha audio/reviews despite Tasks assignment access.
- [ ] P cannot assign Alpha work to Beta-only members.
- [ ] Revoking Alpha leaves P's Beta and personal home intact.
- [ ] Account switch clears P data before another account renders.

---

## 6. Core regression matrix per package

In addition to package tests:

- Sign in/out/account switch and active artist restoration
- Artist owner, Pro personal home, entered artist workspace, dual-role account
- Today, Board, Tracks, Projects, Tasks, Calendar, Team, Messages, Settings
- Track playback, signed audio, comments, decisions, guest review link
- Track collaborator remains track-scoped
- Social/Scenes profiles and messages remain correctly attributed
- Admin privacy tests and support messages
- Pulse and in-app notification dedupe
- Browser and TEMPO Desktop
- 320–390px mobile and desktop zoom
- Keyboard and screen reader labels
- Reduced motion
- Online → offline → reconnect cache/access behavior
- Version displayed under Settings matches package version

---

## 7. Rollout stages

### Stage 1 — Schema dark launch

- Apply migration to isolated project, then preview/staging.
- Run full direct RLS matrix and migration rerun/ledger checks.
- Deploy nullable schema/helper support with feature gate off.
- Verify admin system health without exposing creative data.

### Stage 2 — Internal/admin accounts

- Enable for platform-admin-owned test artists only.
- Exercise multi-account invitation, assignment, suspension, and room flows.
- Inspect errors, query counts, and notification dedupe.

### Stage 3 — Selected beta teams

- Enable per artist or per user for teams who explicitly opt in.
- Start with Permission truth, then lifecycle, assignments, Brief, room, Pro operations in package order.
- Offer starter kits only after the Pro operations home is stable; begin with internal accounts and explicit opt-in.
- Collect qualitative feedback on language and queue usefulness.

### Stage 4 — General invited program

- Enable package after its security and product acceptance gates pass.
- Announce only shipped layers in PRODUCT/CHANGELOG.
- Keep delegated Team/Social Write owner-only unless separately released.

---

## 8. Observability

Use existing privacy-safe product events with enum/bucket properties only.

Allowed examples:

```text
team_invite_reviewed { outcome, existing_member }
team_membership_changed { transition }
work_assigned { kind, due_bucket }
my_work_opened { open_count_bucket, artist_count_bucket }
work_completed { kind, age_bucket }
team_brief_opened { first_open, has_authored_content }
team_room_used { action: message|mention|pin|link }
pro_schedule_opened { artist_count_bucket, conflict_count_bucket }
pro_starter_kit_viewed { entry: first_open|settings, selected_count_bucket }
pro_starter_kit_completed { mode: templates_only|templates_and_samples|blank|remind_later, selected_count_bucket, result_bucket }
```

Forbidden properties:

- Artist/person/task/project/track names or ids
- Request text, notes, messages, brief content, URLs
- Email addresses or invite tokens
- File paths/names
- Exact schedule or availability note
- Per-member productivity ranking

Operational alerts:

- Lifecycle RPC failure rate
- Permission-denied spike after rollout
- Team-room participant drift count
- Notification delivery failure count
- My Work RPC latency and capped-result rate
- Migration/schema feature-gate mismatch

---

## 9. Rollback strategy

### General

- Disable the application feature gate first.
- Keep additive columns/tables in place; do not drop production data as rollback.
- Revert policies/helpers only with a reviewed additive follow-up migration that restores the last safe behavior.
- Preserve membership events, assignment history, authored brief, and room messages.

### Package-specific

- Permission issue: gate member surface off; owner paths remain; apply restrictive follow-up policy.
- Assignment issue: disable assignment mutation/My Work; existing tasks remain valid and assignment columns harmless.
- Lifecycle issue: disable nonessential transitions; emergency owner revoke remains server-guarded and audited.
- Brief issue: disable edit/render; source objects untouched.
- Room issue: remove entry/gate; conversation data remains; participant access policy stays restrictive.
- Schedule issue: disable combined view; individual artist Calendars remain authoritative.
- Starter-kit issue: disable prompt/installer; existing installed user-owned records remain ordinary content and are not bulk deleted.

Never “fix” a rollout by resetting the database or deleting affected team history.

---

## 10. Blocking decisions before Package 1

| Decision | Recommended default | Owner approval required |
|---|---|---|
| Existing Catalog compatibility split | Map current intended behavior into explicit Catalog/Audio/Feedback/Tasks grants once, preserving no more than users effectively had | Yes |
| Assignee with Tasks Read | May update status only through narrow RPC; cannot edit title/due/notes | Yes |
| Task delete by Team Write | Owner-only in Team Operations 1.0 | Yes |
| Calendar event delete | Owner or original creator only; no broad team delete | Yes |
| Stats Write | Normalize to Read until a dedicated editable-stats design | Yes |
| Team Write | Owner only until separate non-escalation package | Yes |
| Social Write | Owner only until audited draft/publish package | Yes |
| Team Brief edit | Owner only initially | Yes |
| Team room default membership | Artist owner plus every active artist-level team member | Yes |
| Availability sharing | Off by default; explicit Pro opt-in | Yes |
| Starter-kit default | Optional; templates only selected by default, private sample board off, Start blank always available | Yes |
| Multi-role layout | One user-chosen primary home emphasis; content templates combine and dedupe by semantic key | Yes |
| Kit updates/removal | Add missing defaults only; remove only untouched private examples; never overwrite edited/user-created content | Yes |

No SQL for Package 1 should be written until these defaults are accepted or replaced.

---

## 11. Definition of done for Team Operations 1.0

- [ ] Packages 1–8 and optional 8A shipped in order or explicitly deferred with UI truthfully reflecting the deferral.
- [ ] All five specification documents match implementation.
- [ ] Permission matrix passes direct non-production database tests.
- [ ] Existing memberships migrated without unintended access expansion.
- [ ] Artist owner can assign and safely offboard.
- [ ] Pro can act across artists without leaking cross-artist context.
- [ ] Pro can choose, combine, defer, or decline starter kits without changing access; installs remain private, idempotent, and non-destructive.
- [ ] Team Brief and team room are active-member-only.
- [ ] Web, mobile, desktop, offline/reconnect, keyboard, screen-reader, and reduced-motion checks pass.
- [ ] Existing track collaborator, guest, Social, Scene, messaging, admin, and privacy regressions pass.
- [ ] PRODUCT describes only shipped behavior; CHANGELOG gives required migration/deployment actions.
