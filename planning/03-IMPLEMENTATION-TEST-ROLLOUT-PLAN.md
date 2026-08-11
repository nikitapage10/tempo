# TEMPO — Activation, Reliability, and Pulse implementation, test, and rollout plan

## 1. Global execution rules

1. Implement one package at a time.
2. Before adding test dependencies, present exact packages, versions, scripts, and CI cost for approval as required by TEMPO's existing testing strategy.
3. Never use production Supabase for automated tests.
4. Use the next available migration number. Never rename or edit an applied migration.
5. After creating each migration, stop and wait for explicit Supabase success confirmation before writing dependent application code.
6. Use preview deployments for member-facing or scheduler changes.
7. Feature flags control exposure only; they are not security.
8. Bump application version and update CHANGELOG, PRODUCT, architecture/data/security/testing documentation only when the corresponding package ships.
9. Roll back application code by promoting a prior deployment; forward-fix additive database changes.

## 2. Package sequence

### Package AR-0 — Baseline and decisions

No product code or schema.

- Inventory actual migrations, tables, RLS policies, reminder scheduler, notification triggers, Realtime publications, Resend sender/webhooks, and CI configuration.
- Confirm latest production migration/capability state without exposing user content.
- Capture baseline build time, manual smoke results, current activation cohort counts obtainable from authoritative data, delivery volume, and known failure modes.
- Decide local Supabase versus a dedicated test project.
- Present dependency proposal for approval.

Exit gate:

- Architecture inventory is documented.
- Test environment cannot address production by configuration.
- Existing notification/reminder primitives selected for reuse.

### Package AR-1 — Automated reliability foundation

No production schema unless isolated-test helpers are required outside production.

Recommended stack, subject to approval:

- Vitest for pure unit tests.
- Playwright for browser E2E.
- Supabase CLI/local containers or a dedicated isolated project for RLS/data tests.
- GitHub Actions for CI.

Deliver:

- Unit harness and deterministic fixture factories.
- Test-only environment validation that refuses production URLs/project refs.
- Build/type/unit jobs.
- A bounded E2E smoke job.
- Artifact capture on failure: screenshot, trace, safe browser console, sanitized network metadata.
- Documented local and CI commands.

Exit gate:

- A deliberate regression causes CI to fail.
- Test environment guard rejects the production project.
- Core suite is deterministic across three consecutive runs.

### Package AR-2 — Permission, token, migration, and health gates

Possible additive migration: migration ledger only if not already available.

Deliver:

- Direct RLS tests for owner/editor/uploader/commenter/viewer/unauthorized/guest.
- Guest-token valid/expired/revoked/tampered tests.
- Migration/capability health endpoint and Admin status surface.
- CI check for migration filename ordering and duplicate numbers.
- Safe production smoke checks that never create or read creative content unless using a dedicated operator test account.

Exit gate:

- Any cross-account access failure blocks release.
- Missing required migration is visible before dependent UI usage.
- Health endpoint exposes no secrets or private content.

### Package AR-3 — Privacy-safe product events

Additive migration: `product_events` and activation guide preferences; optional aggregate table deferred.

Deliver:

- Versioned event registry.
- Validated ingestion boundary.
- Instrument only the core funnel and failures first.
- Event reconciliation for authoritative milestones.
- Admin ingestion-health counters, not full activation dashboard yet.
- Settings privacy explanation.

Initial instrumentation order:

1. Session start.
2. Import start/review/complete/fail.
3. First track and workflow intent.
4. Focus start/complete.
5. Upload start/complete/fail.
6. Guest/collaborator share.
7. External feedback and resolution.

Exit gate:

- Property-fuzz tests prove prohibited fields are rejected/stripped.
- Milestone reconciliation identifies intentionally dropped test events.
- Duplicate events do not change unique milestone counts.
- Admin cannot retrieve a user-level event feed.

### Package AR-4 — Contextual value path

No new schema beyond guide preferences unless measured query performance requires an aggregate RPC/view.

Deliver:

- Pure journey derivation utility and unit tests.
- Today module with adaptive step, reason, CTA, progress text, partial-error behavior.
- Existing-member collapsed invitation.
- Snooze/hide/restore/completion acknowledgement.
- Settings restore control.
- Mobile, keyboard, screen reader, and reduced-motion verification.

Rollout:

- Internal/operator accounts.
- Small beta cohort.
- All new accounts.
- Existing accounts collapsed.

Exit gate:

- No step can complete from a click alone.
- No inaccessible/deleted entity remains linked.
- The module never duplicates urgent Today items or hides them below decorative content.

### Package AR-5 — Pulse preferences and in-app briefing

Additive migration: notification preferences. Reuse existing tables where equivalent.

Deliver:

- Notification settings UI.
- Pure Pulse item normalization, priority, dedupe, sensitivity, and category rules.
- In-app Today Pulse module.
- Deduplication against Tasks due and Needs attention.
- No email yet.

Exit gate:

- In-app Pulse cannot expose tracks a collaborator no longer accesses.
- Message/support bodies are not selected by the Pulse aggregator.
- Category and timezone preference validation is complete.

### Package AR-6 — Pulse email delivery

Additive migration: delivery queue, suppressions, preference tokens, plus any required provider webhook state.

Deliver:

- Scheduler integration reusing existing reminder infrastructure where possible.
- Atomic claims, leases, idempotency, retry/backoff, suppression.
- Server-rendered daily/weekly and immediate-awareness emails.
- Resend webhook verification for delivered/bounced/complained events supported by the provider.
- One-click unsubscribe and authenticated Manage preferences.
- Admin queue/delivery health.

Rollout:

- Provider sandbox/operator addresses.
- Internal accounts with forced generic labels.
- Opt-in beta cohort.
- General opt-in availability.

Exit gate:

- Duplicate scheduler invocation sends at most one email per dedupe key.
- Access removal before send removes the item.
- Empty digest suppression and window advancement are correct.
- Hard bounce/complaint/unsubscribe blocks future optional email.
- No email body or sensitive creative content appears in database/logs.

### Package AR-7 — Activation and Pulse Admin analytics

Use raw aggregate queries initially. Add a daily aggregate table only after measured need.

Deliver:

- Cohort funnel.
- Time-to-milestone.
- D1/D7/D30 return.
- Guide exposure/action/snooze/hide.
- Pulse opt-in/send/failure/open-return metrics.
- Small-cohort suppression.
- Data freshness and definition-version labels.

Exit gate:

- Numbers reconcile against deterministic test fixtures.
- No individual creative activity timeline or prohibited content is queryable through the Admin route.
- Old and new activation definition versions are not silently mixed.

### Package AR-8 — Stabilization and decision review

- Run full regression and accessibility suites.
- Conduct qualitative interviews with new and existing beta artists.
- Compare funnel against baseline.
- Fix confusing steps, delivery noise, and failure clusters.
- Decide whether the next feature should be broader notification delivery, external calendar interoperability, or a different observed bottleneck.

No new major domain feature is added inside this package.

## 3. Automated test portfolio

### 3.1 Pure unit tests

| Domain | Required cases |
|---|---|
| Attention and activation derivation | Every step, adaptive ordering, partial sources, deleted entity, existing member, completion, snooze/hide |
| Event contract | Every allowed event, unknown event, extra keys, prohibited strings/IDs, size/time limits, dedupe |
| Pulse normalization | Category mapping, sensitivity, access removal, Today dedupe, caps, stable ordering |
| Multi-artist scope | Active-artist in-app scope, one account-wide email, no double counting, shared-track authorization |
| Scheduling | Daily/weekly cadence, timezone change, pause, quiet hours, DST gap/repeat, missed run recovery |
| Delivery retry | Transient/permanent classification, exponential backoff, claim expiry, max attempts |
| Version retention | Current/pinned/two newest unpinned |
| Permission helpers | All roles/capabilities |
| Guest token helpers | Hash, expiry, revoke, fixed version |
| Stage recipe validation | Preview/automatic/idempotency |
| Calendar normalization | Existing date/time/DST rules |

### 3.2 Database/RLS integration tests

Use deterministic accounts and data in isolated Supabase:

- Owner CRUD and cross-owner denial for every new table.
- Collaborator access limited by shared track and role.
- Product event ingestion cannot spoof user/artist/space.
- Product event SELECT is denied to browser roles.
- Guide preferences isolated per user/artist.
- Notification preferences owner-only.
- Delivery/suppression/token tables inaccessible to browser writes.
- Claim operation is atomic under two workers.
- Unique dedupe prevents duplicates.
- Account/artist deletion cascades only intended rows.
- Existing creative RLS remains unchanged unless explicitly required.

### 3.3 Browser E2E tiers

#### Pull-request smoke

- Sign in.
- Today loads.
- Create track and set next move.
- Start/end focus session.
- Upload a small MP3 and play it.
- Generate guest link and validate public review access.
- Confirm unauthorized workspace access is denied.
- Guide advances from authoritative outcomes.
- Notification preferences save.

#### Nightly/full isolated suite

- Import conversation through atomic build with mocked AI response contract.
- WAV/AIFF conversion path where CI resources allow.
- Comment/reply/resolve across versions.
- Collaboration invite acceptance and every role.
- Stage recipe entry from Board and track timeline.
- Calendar create/recurrence/reminder/reschedule workflows based on current product.
- Messaging unread/archive/attachment authorization with bodies excluded from Pulse.
- Pulse scheduling, provider mock, retry, unsubscribe, and suppression.
- Multi-artist digest grouping and generic-label privacy default.
- Mobile viewports and keyboard navigation.
- Reduced motion.

### 3.4 Manual retained tests

Automation does not replace:

- Audio quality/listening judgment.
- Real provider email rendering across representative clients.
- Spectra animation and artwork visual quality.
- Drag feel and dense-board usability.
- Voice dictation browser behavior.
- PWA install/relaunch.
- Final production smoke using a designated non-sensitive operator test account.

## 4. CI and release gates

Required before merge to main:

1. Formatting/lint if currently configured.
2. Type check and production build.
3. Unit tests.
4. Migration order/checksum/static checks.
5. RLS/data integration suite.
6. Pull-request E2E smoke on preview or isolated app environment.

Nightly/non-blocking until stabilized:

- Full browser suite.
- Accessibility scan plus manual keyboard spot-check.
- Provider webhook contract tests.
- Performance budgets for Today, Board, track workspace, and Calendar.

Promote a nightly check to required only after it is deterministic. Do not normalize flaky release gates.

## 5. Observability

Log structured operational metadata only:

- Request/correlation ID.
- Route/job name.
- Safe failure class.
- Duration/status/count.
- Delivery ID/provider ID where appropriate.
- No email body, message/comment text, creative title, filename/path, raw token, or secret.

Alerts:

- Scheduler has not succeeded within two expected intervals.
- Oldest pending delivery exceeds threshold.
- Claimed-expired or terminal failure rate exceeds threshold.
- Product event rejection/duplicate rate spikes.
- Migration capability mismatch after deployment.
- RLS/test gate failure always blocks release rather than alerting after release.

## 6. Rollback and recovery

- UI or instrumentation regression: disable rollout/exposure and promote previous application deployment.
- Event ingestion outage: product continues; reconciliation restores authoritative milestones later.
- Scheduler outage: in-app notifications continue; queued email resumes with caps to avoid a burst.
- Provider outage: retry with backoff; allow operator to pause outbound delivery globally.
- Bad email template: disable that delivery kind; do not delete queue history.
- Bad additive migration: forward-fix with a new migration. Do not drop production data.
- Unsubscribe/suppression bug: fail closed for optional email until repaired.

## 7. Launch checklist

### Before internal rollout

- [ ] Dependency/test-environment approval recorded.
- [ ] Production project guard proven.
- [ ] Existing migrations/reminder/notification schemas inspected.
- [ ] RLS and guest token suites green.
- [ ] Product event privacy fuzz tests green.
- [ ] Admin health surface green without secrets.

### Before guide beta

- [ ] Baseline funnel recorded.
- [ ] Journey derivation fixtures cover new/existing/collaborator users.
- [ ] Today duplication/priority rules verified.
- [ ] Mobile/a11y/reduced-motion pass complete.
- [ ] Hide/snooze/restore behavior verified.

### Before email beta

- [ ] Verified notification sender configured.
- [ ] Scheduler secret and webhook signature configured server-side.
- [ ] Dedupe, two-worker claim, retry, pause, bounce, complaint, unsubscribe tests pass.
- [ ] Generic-label default confirmed.
- [ ] No message/comment body or signed storage URL in email snapshots.
- [ ] Operator global pause control tested.

### Before general opt-in availability

- [ ] Beta complaint/unsubscribe/failure rates acceptable.
- [ ] Backlog and last-run alerts operating.
- [ ] Privacy/Settings copy reviewed.
- [ ] Support team has troubleshooting states without private-content access.
- [ ] PRODUCT, CHANGELOG, DATA MODEL, ARCHITECTURE, SECURITY, TESTING, and DEPLOYMENT docs updated.

## 8. Definition of done

The program is complete only when:

- Core release checks are automated and consistently enforced.
- Migration and service health are visible before members encounter failures.
- Activation milestones are measured without creative content.
- The contextual guide advances from authoritative state and is optional.
- Pulse is coherent in-app and optionally delivered by email with preference, privacy, idempotency, and suppression guarantees.
- Admin reporting is aggregate and reconciled.
- The full test and rollout checklists pass in isolated and production-safe environments.
- Observed results have been reviewed before choosing another large feature.
