# TEMPO — Activation, Reliability, and Pulse technical and data design

## 1. Current architecture to preserve

- Next.js App Router with TypeScript strict.
- Supabase Postgres, Auth, RLS, Realtime, and private Storage.
- Browser → Supabase + user JWT for ordinary authenticated data.
- Server-only service-role access for narrow privileged operations.
- TanStack React Query for client state.
- Existing `notifications` rows and realtime invalidation for the signed-in user.
- Existing Calendar reminder/planning model and Resend integration.
- Numbered additive migrations, manually confirmed before dependent UI ships.

At implementation time, inspect the actual migrations through the latest applied version. The planning sources document migrations through at least `041_track_groups.sql`, but exact production schema is authoritative. Reuse existing notification/reminder/delivery columns when they already satisfy this design; do not create duplicate concepts merely to match names below.

## 2. Component boundaries

### 2.1 Reliability foundation

- Pure domain utilities remain framework-independent and receive unit coverage.
- End-to-end tests run against a local or dedicated test Supabase project.
- CI runs type/build, unit, permission/data integration, and bounded browser smoke checks.
- A guarded Admin health endpoint reports capabilities, scheduler health, delivery health, and event ingestion health without exposing secrets.

### 2.2 Analytics ingestion

- Client and server call one typed `recordProductEvent` boundary.
- The caller never supplies `user_id`; authenticated identity is derived from the session/JWT.
- Event names and property keys are allowlisted by version.
- Unknown names/keys are rejected or stripped and counted as ingestion errors.
- Critical milestone events are also derivable from authoritative tables so analytics can be reconciled.

### 2.3 Activation derivation

- A pure `deriveActivationJourney` function receives facts the member may already read.
- It returns completed outcomes, current recommendation, reason, target route/action, and data-quality warnings.
- It does not write progress rows.
- Only display preferences (snooze/hide/acknowledge) are stored.

### 2.4 Pulse aggregation

- A server-only aggregator evaluates authoritative records at render/send time.
- It returns normalized Pulse items with category, urgency, generic label, optional detailed label, destination, and dedupe identity.
- In-app rendering may use authenticated client queries where RLS is sufficient.
- Email generation must execute server-side and re-check authorization immediately before send.
- In-app aggregation is scoped to the active artist/space plus global message awareness. Email aggregation is account-wide across owned artists and explicitly shared tracks, producing one delivery per user/window.

### 2.5 Scheduling and delivery

- Reuse the scheduler behind existing Calendar reminders if it is production-safe and supports the required cadence.
- Otherwise use one authenticated dispatch endpoint invoked every 15 minutes by the deployment scheduler.
- The dispatcher claims due work atomically, uses idempotency keys, retries transient errors, and quarantines permanent failures.
- Resend is the preferred provider because it already exists for program invitations. Use a verified notification sender on the same domain.

## 3. Schema blueprint

Names are recommendations. Use the next available migration number and reconcile against the actual schema before writing executable SQL.

### 3.1 `product_events`

Append-only privacy-safe product telemetry.

| Column | Type | Rules |
|---|---|---|
| `id` | uuid PK | Server/database generated |
| `user_id` | uuid NOT NULL → auth.users CASCADE | Derived from authenticated caller |
| `artist_id` | uuid NULL → artists SET NULL | Allowed only when caller belongs to artist |
| `space_id` | uuid NULL → spaces SET NULL | Allowed only when caller can access space |
| `event_name` | text NOT NULL | Allowlisted taxonomy |
| `event_version` | smallint NOT NULL default 1 | Schema version for properties |
| `occurred_at` | timestamptz NOT NULL | Server time; bounded client time may be a separate property if required |
| `received_at` | timestamptz NOT NULL default now() | Ingestion diagnostics |
| `session_id` | uuid NULL | Random app-session identifier, rotates after inactivity/sign-out |
| `source_surface` | text NULL | Allowlisted: import/today/track/focus/calendar/etc. |
| `properties` | jsonb NOT NULL default `{}` | Allowlisted non-content properties only |
| `dedupe_key` | text NULL | Unique per user when supplied |

Constraints and indexes:

- Unique partial index on `(user_id, dedupe_key)` where non-null.
- Index `(event_name, occurred_at)` for aggregate reporting.
- Index `(user_id, occurred_at)` for retention cleanup/reconciliation only; not exposed to Admin UI.
- Check JSON object size and maximum serialized length.
- Check `occurred_at` is not implausibly old/future.
- No client UPDATE or DELETE.

RLS/API:

- RLS enabled.
- No general authenticated SELECT.
- Insert only through an RPC or guarded server route that sets `user_id`, validates ownership, and applies the event contract.
- Service-role aggregate reads only through centralized allowlisted query code.

Retention:

- Raw rows: 180 days by default.
- Daily aggregate cohorts: retain long-term without user identifiers.
- Account deletion cascades raw user events.
- Retention policy is documented in Settings/Privacy and may be shortened without affecting product behavior.

### 3.2 `product_event_daily_aggregates`

Optional after query volume justifies it. Do not build before measuring raw-query performance.

| Column | Type | Rules |
|---|---|---|
| `event_date` | date | Part of PK |
| `event_name` | text | Part of PK |
| `cohort_key` | text | Controlled grouping such as signup week/onboarding path |
| `event_count` | bigint | Aggregate only |
| `unique_user_count` | bigint | Aggregate only |
| `computed_at` | timestamptz | |

No user IDs or creative IDs. Service-role only.

### 3.3 `activation_guide_preferences`

Stores only guide presentation state. Progress remains derived.

| Column | Type | Rules |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL → auth.users CASCADE | |
| `artist_id` | uuid NOT NULL → artists CASCADE | |
| `hidden_at` | timestamptz NULL | Persistent hide |
| `snoozed_until` | timestamptz NULL | Seven-day default but schema accepts future UI options |
| `completed_acknowledged_at` | timestamptz NULL | Does not define completion |
| `restored_at` | timestamptz NULL | Audit latest restore |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | Trigger maintained |

Unique `(user_id, artist_id)`. Owner may CRUD only their own row and only for artists they can use. If artist deletion cascades this row, no creative data is affected.

### 3.4 `notification_preferences`

One row per user for delivery defaults. If current Calendar reminders already store a user timezone or quiet hours, choose one canonical source and migrate/reuse it.

| Column | Type | Rules |
|---|---|---|
| `user_id` | uuid PK → auth.users CASCADE | |
| `timezone` | text NOT NULL | Valid IANA timezone |
| `email_pulse_enabled` | boolean NOT NULL default false | Explicit opt-in |
| `digest_frequency` | text NOT NULL | `off`, `daily`, `weekly` |
| `delivery_local_time` | time NOT NULL default `08:00` | Interpreted in IANA timezone |
| `weekly_delivery_day` | smallint NULL | ISO 1–7; required for weekly |
| `quiet_hours_start` | time NULL | Both quiet-hour fields null or both set |
| `quiet_hours_end` | time NULL | May wrap midnight |
| `paused_until` | date NULL | Local date semantics |
| `include_entity_names` | boolean NOT NULL default false | Privacy-sensitive explicit toggle |
| `immediate_guest_feedback` | boolean NOT NULL default false | |
| `immediate_collaboration` | boolean NOT NULL default false | |
| `immediate_message_awareness` | boolean NOT NULL default false | Count only |
| `category_due` | boolean NOT NULL default true | Applies when email enabled |
| `category_attention` | boolean NOT NULL default true | |
| `category_feedback` | boolean NOT NULL default true | |
| `category_collaboration` | boolean NOT NULL default true | |
| `category_messages` | boolean NOT NULL default true | |
| `category_calendar` | boolean NOT NULL default true | |
| `category_progress` | boolean NOT NULL default true | Weekly relevance |
| `last_digest_window_end` | timestamptz NULL | Advances only after successful/no-content evaluation |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

Checks enforce cadence/day combinations, valid timezone, and quiet-hour pairing. Users may SELECT/UPDATE only their own row. Inserts should set secure defaults and ignore caller-supplied user IDs.

### 3.5 `notification_deliveries`

Idempotent queue and audit record for outbound optional email. Do not store rendered bodies.

| Column | Type | Rules |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL → auth.users CASCADE | Recipient |
| `channel` | text NOT NULL | `email` initially |
| `delivery_kind` | text NOT NULL | `daily_digest`, `weekly_digest`, `guest_feedback`, `collaboration`, `message_awareness` |
| `template_version` | smallint NOT NULL | |
| `window_start` | timestamptz NULL | Digest interval |
| `window_end` | timestamptz NULL | Digest interval |
| `scheduled_for` | timestamptz NOT NULL | UTC |
| `status` | text NOT NULL | `pending`, `claimed`, `sent`, `retry`, `suppressed`, `failed`, `cancelled`, `no_content` |
| `dedupe_key` | text NOT NULL UNIQUE | Stable across retries |
| `attempt_count` | smallint NOT NULL default 0 | |
| `claimed_at` | timestamptz NULL | Lease start |
| `claim_expires_at` | timestamptz NULL | Allows recovery after worker death |
| `sent_at` | timestamptz NULL | |
| `provider_message_id` | text NULL | No provider request body |
| `next_attempt_at` | timestamptz NULL | Backoff |
| `error_class` | text NULL | Safe normalized class |
| `error_message` | text NULL | Short provider-safe message; no headers/body/secrets |
| `item_counts` | jsonb NOT NULL default `{}` | Counts by allowed category only |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

Indexes:

- `(status, scheduled_for)` and `(status, next_attempt_at)` for claims.
- `(user_id, created_at desc)` for preference/status display via guarded server API.
- Unique `dedupe_key` prevents repeated sends for the same window/event.

Access:

- RLS enabled with no browser write policy.
- User-facing Settings may read a sanitized latest-delivery status through a guarded route/RPC.
- Only scheduler/service role creates, claims, updates, or retries.

### 3.6 `email_suppressions`

Canonical block list for optional outbound email.

| Column | Type | Rules |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NULL → auth.users CASCADE | Null only if provider webhook cannot map safely |
| `email_hash` | text NOT NULL | Normalized email SHA-256; never a lookup token exposed to client |
| `reason` | text NOT NULL | `unsubscribe`, `hard_bounce`, `complaint`, `operator` |
| `provider_event_id` | text NULL UNIQUE | Webhook idempotency |
| `active` | boolean NOT NULL default true | |
| `created_at` | timestamptz NOT NULL | |
| `cleared_at` | timestamptz NULL | Complaint/hard bounce should require operator review before clear |

Service role only. Sending checks active suppressions after scheduling and again immediately before provider submission.

### 3.7 `email_preference_tokens`

Supports no-sign-in unsubscribe/manage links without exposing account identifiers.

| Column | Type | Rules |
|---|---|---|
| `user_id` | uuid PK → auth.users CASCADE | |
| `token_hash` | text NOT NULL UNIQUE | SHA-256 only |
| `created_at` | timestamptz NOT NULL | |
| `rotated_at` | timestamptz NULL | |

Raw token is generated server-side and only placed in email URLs. Endpoint is rate-limited, generic on invalid tokens, `no-store`, and may disable optional email without authentication. Changing granular preferences requires sign-in unless the product explicitly designs a safe token-scoped preference page.

### 3.8 `schema_migrations` ledger

Introduced only if the actual repository does not already track applied migrations reliably.

| Column | Type | Rules |
|---|---|---|
| `version` | integer PK | Migration number |
| `name` | text NOT NULL | Immutable filename stem |
| `checksum` | text NOT NULL | Checksum of the applied migration artifact |
| `applied_at` | timestamptz NOT NULL default now() | |
| `applied_by` | text NULL | Operator/system label, not a secret |

Backfill of historical versions is a separately reviewed administrative migration and must not claim migrations that have not been verified. Future migrations register themselves only after all statements succeed in the same transaction.

### 3.9 Feature rollout configuration

Prefer an existing feature-flag mechanism. If none exists and staged rollout cannot be managed safely with deployment configuration, add a service-role-only `feature_rollouts` table:

`key` PK; `state` (`off`, `internal`, `beta`, `on`); `percentage` 0–100; `allow_user_ids` uuid[]; non-sensitive `config` jsonb; timestamps.

Flags control exposure, never authorization. RLS and route guards remain authoritative.

## 4. Product event contract

### 4.1 Allowed events

Every event has version 1 unless noted. Properties listed are exhaustive; unknown properties are stripped/rejected.

| Event | Trigger | Allowed properties |
|---|---|---|
| `account_session_started` | Authenticated app session begins after inactivity threshold | `entry_surface`, `days_since_prior_session_bucket` |
| `import_started` | Import session created | `input_modes` enum array, `is_first_run` |
| `import_review_reached` | Review screen is usable | `item_count_bucket`, `needs_attention_bucket` |
| `import_completed` | Atomic workspace build succeeds | `track_count_bucket`, `project_count_bucket`, `task_count_bucket`, `duration_bucket` |
| `import_failed` | Terminal build failure | `failure_class`, `phase` |
| `first_track_created` | First authoritative track exists for user | `creation_path` (`manual`,`import`) |
| `workflow_intent_set` | First next move/due/block/waiting state is saved | `intent_type`, `source_surface` |
| `focus_session_started` | Session row created | `source_surface`, `has_goal`, `checklist_count_bucket` |
| `focus_session_completed` | Completion persisted | `duration_bucket`, `next_move_updated`, `bounce_uploaded` |
| `version_upload_started` | Upload begins | `file_type`, `size_bucket`, `source_surface` |
| `version_upload_completed` | Row/storage commit succeeds | `file_type`, `size_bucket`, `conversion_used`, `duration_bucket` |
| `version_upload_failed` | Terminal upload failure | `failure_class`, `phase`, `file_type`, `size_bucket` |
| `guest_link_created` | Link row created | `expiry_bucket`, `comments_enabled`, `download_enabled` |
| `collaborator_invited` | Invite row created | `role`, `delivery_mode` |
| `external_feedback_received` | First eligible guest/collaborator feedback persists | `feedback_type`, `author_kind` |
| `feedback_resolved` | Thread/decision resolution persists | `feedback_type`, `age_bucket` |
| `release_plan_created` | Confirmed release-plan creation succeeds | `task_count_bucket`, `source_surface` |
| `activation_guide_viewed` | Guide becomes meaningfully visible | `recommended_step`, `state` |
| `activation_guide_actioned` | Primary CTA used | `recommended_step` |
| `activation_guide_snoozed` | Preference save succeeds | `recommended_step`, `days` |
| `activation_guide_hidden` | Preference save succeeds | `recommended_step` |
| `activation_loop_completed` | Derived completion first observed and deduped | `activation_definition_version`, `days_since_signup_bucket` |
| `pulse_preferences_updated` | Preference save succeeds | `frequency`, category booleans, immediate booleans, `include_entity_names` |
| `pulse_digest_scheduled` | Delivery row committed | `delivery_kind`, `item_count_bucket` |
| `pulse_digest_sent` | Provider accepts message | `delivery_kind`, category count buckets |
| `pulse_digest_suppressed` | Send intentionally skipped | `reason`, `delivery_kind` |
| `pulse_digest_failed` | Terminal delivery failure | `failure_class`, `delivery_kind` |
| `pulse_link_opened` | Authenticated deep link carries a short-lived campaign marker | `delivery_kind`, `destination_surface`; never raw URL |

### 4.2 Prohibited event data

The recorder must reject or remove:

- Titles, filenames, storage paths, URLs, handles, names, email addresses, free text.
- Track/project/task/comment/message IDs in event properties.
- Notes, lyrics, comments, messages, feedback text, goals, prompts, generated output.
- Audio/image/document contents or metadata beyond bucketed file type/size.
- Precise duration/size/count when a bucket supplies sufficient product insight.
- IP address, fingerprint, advertising identifier, or third-party tracking cookie.

Top-level artist/space IDs are allowed only for ownership-safe aggregate scoping and must not appear in Admin output. Track IDs are not stored in telemetry.

### 4.3 Event reliability

- Milestone events use a deterministic dedupe key such as `first_track_created:v1` per user or a one-way hash of an internal transaction identity.
- Client events may be best-effort, but authoritative milestone reconciliation runs daily from database facts.
- Reconciliation inserts missing milestones with `source_surface = reconciliation`; it never fabricates UI-view/click events.
- Duplicate rate and rejection rate are Admin health metrics.

## 5. Activation derivation contract

Input facts:

- Counts/timestamps for accessible tracks, workflow fields, sessions, versions, guest links, collaborators, eligible feedback, and unresolved feedback.
- Current user/artist and guide preferences.
- Per-source query health.

Output:

- `definitionVersion`.
- `completedSteps[]` with authoritative evidence type and completion date (not creative labels).
- `recommendedStep`.
- `reasonCode` and safe display explanation.
- `target` route/action with entity ID held in normal app state, not telemetry.
- `state`: `active`, `waiting`, `complete`, `snoozed`, `hidden`, `partial`.
- `warnings[]` for unavailable sources.

Rules must be pure and unit-tested. Do not derive completion from product events because event ingestion may fail; analytics observes product state, product state does not depend on analytics.

## 6. Pulse aggregation contract

### 6.1 Normalized item

Each item contains:

- Stable internal `dedupeIdentity`.
- `category` and `urgency` (`critical`, `today`, `soon`, `awareness`).
- `occurredAt` or `dueAt`.
- Generic label safe for email.
- Optional named label used only when preference permits.
- Count and reason code.
- Authorized application destination.
- `alreadyRepresentedOnToday` flag for in-app deduplication.
- `sensitivity` (`generic`, `entity_name`, `never_email`).

The normalized item may carry artist/entity IDs internally for authorization and deep linking, but those IDs are never copied into product-event properties, provider metadata, or rendered generic email text. They remain server-side and ephemeral unless an existing notification/source record already stores them.

### 6.2 Window semantics

- Digest window begins at the last successfully evaluated window end, not the last attempted send.
- Window ends at scheduler evaluation time rounded consistently.
- A no-content evaluation may advance the window and records `no_content` to prevent repeated scanning.
- Late events inside a closed window may appear in the next digest if they were received after the prior evaluation; dedupe prevents repeat sends.
- User timezone changes affect future scheduling, not already sent windows.
- DST gaps move delivery to the next valid local instant; repeated local times send once using dedupe key.

### 6.3 Priority and limits

Use deterministic ordering: urgency → due/occurred time → category priority → stable identity. Apply per-section and total caps after access filtering. Never use AI ranking in v1.

## 7. Scheduler and delivery mechanics

1. Scheduler finds users whose local cadence is due and who are not paused/suppressed.
2. It creates one `notification_deliveries` row per user/window with a unique dedupe key.
3. Worker atomically claims a bounded batch by moving `pending/retry` to `claimed` with a lease.
4. For each claim, re-read preferences, suppression, current email, and accessible product state.
5. Aggregate Pulse items and apply sensitivity/category rules.
6. If empty, mark `no_content` and advance the user's window.
7. Render email in memory and submit to Resend with provider idempotency where supported.
8. On success, mark sent, store provider message ID and counts, then advance the window.
9. On transient failure, set retry with exponential backoff and jitter.
10. On permanent failure, mark failed/suppressed as appropriate and expose a friendly preference status.

Suggested retry policy: 1 minute, 5 minutes, 30 minutes, 2 hours, then terminal after five attempts. Adjust to provider guidance during implementation.

Concurrency rules:

- Claim with `FOR UPDATE SKIP LOCKED` or an equivalent atomic RPC.
- Expired claim leases return to retry.
- Dedupe key format includes user, kind, and canonical window, but should be hashed before provider use.
- Scheduler endpoint requires a secret header, is rate-limited, logs no rendered content, and returns only counts/status.

## 8. Routes and APIs

Recommended boundaries; fit them to the actual repository conventions.

### Authenticated

- Product event RPC or `/api/product-events` POST: validated allowlisted ingestion.
- Activation facts via existing hooks/queries plus an optional aggregate RPC if measured performance requires it.
- Activation guide preferences CRUD via browser + RLS.
- Notification preferences CRUD via browser + RLS or authenticated route for validation.
- Sanitized delivery health read for the current user.

### Server-only/guarded

- Scheduler dispatch route.
- Resend webhook route with signature verification and event idempotency.
- Admin activation aggregates route.
- Admin system-health route.

### Public token-scoped

- Unsubscribe route using hashed preference token.
- It may disable optional email only. It cannot read account details or granular product preferences.
- Use generic success behavior for valid/invalid/already-used states to avoid an account oracle.

## 9. Realtime and existing notifications

- Preserve the current notification rows and private Realtime invalidation model.
- Pulse does not publish email content to Realtime.
- Prefer linking deliveries to existing notification IDs internally only if actual schema and cascade behavior make it safe; otherwise aggregate from source records.
- Archive/read state in Notifications does not necessarily mean an event should be excluded from a due-date digest. Category-specific rules decide this.
- New direct/support messages invalidate inbox state as today. Pulse sees message counts through guarded APIs and never selects bodies for email generation.

## 10. Security and privacy controls

- RLS authoritative on all authenticated tables.
- Service-role imports remain server-only.
- Scheduler and webhooks authenticate independently of middleware.
- Webhook signature validation happens before parsing trusted provider fields.
- Raw unsubscribe tokens and scheduler secrets are never stored/logged.
- Admin aggregate code imports a central column allowlist and never uses wildcard selects from creative tables.
- Email render logging is prohibited.
- Deep links reauthorize at open time; email possession does not grant workspace access.
- Collaborator Pulse only includes shared-track state allowed by role.
- Account suspension suppresses optional delivery immediately.
- Account deletion cascades preferences/events/queue rows and invalidates unsubscribe tokens.

## 11. Operational health model

Admin health should report:

- Expected versus applied migration/capability state.
- Last successful scheduler run.
- Pending, claimed-expired, retry, failed, and oldest-queued delivery counts.
- Resend configuration presence and verified-sender probe status without showing secrets.
- Product-event accept/reject/duplicate counts for the last 24 hours.
- Reconciliation lag.
- Test-suite version or last CI commit when available from deployment metadata.

Health is status/metadata only. It must not show email content, creative names, or individual event history.

## 12. Technical acceptance checklist

- [ ] Actual migrations and existing reminder/notification schema were inspected before naming new migrations.
- [ ] Schema changes are additive and RLS is enabled before access is granted.
- [ ] Product event properties are allowlisted and content-free.
- [ ] Activation completion derives from authoritative product state, never telemetry.
- [ ] Delivery rows are idempotent, lease-safe, retryable, and contain no rendered body.
- [ ] Suppression is checked at schedule and send time.
- [ ] Timezone and DST semantics are covered by pure tests.
- [ ] Direct/support message bodies and private signed URLs never reach digest generation.
- [ ] Public unsubscribe cannot reveal whether an account exists.
- [ ] Admin endpoints preserve aggregate-only privacy boundaries.
- [ ] Scheduler failure cannot break in-app notifications or core product usage.
