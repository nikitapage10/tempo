# TEMPO — Activation, Reliability, and Pulse specification pack

Status: planning complete; no application code or executable migration SQL is included.

This pack defines the recommended next TEMPO program:

1. Automated release protection and migration health.
2. Privacy-safe product activation measurement.
3. A contextual first-song value path.
4. TEMPO Pulse: configurable in-app and email summaries.

The documents are designed to be handed to a coding agent later, one work package at a time.

## Documents

- `01-PRODUCT-AND-UX-SPEC.md` — product behavior, surfaces, states, copy rules, accessibility, and success measures.
- `02-TECHNICAL-AND-DATA-DESIGN.md` — architecture, schema blueprint, event taxonomy, permissions, scheduler, APIs, retention, and failure handling.
- `03-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md` — package order, migration gates, automated test matrix, observability, rollout, and acceptance criteria.
- `04-EXECUTION-PROMPT.md` — a ready-to-use prompt for implementing the program later.

## Binding decisions

- This is not a generic onboarding tour and does not add a productivity score.
- Activation progress is derived from real TEMPO records. The database stores only display preferences and analytics events, not a second copy of workspace truth.
- Product analytics never include titles, notes, lyrics, comments, messages, file paths, audio, prompts, generated content, or email bodies.
- Admin analytics are aggregate. There is no per-member creative activity timeline.
- Existing in-app notifications remain the canonical inbox. Pulse is a delivery and summarization layer over actionable TEMPO state.
- Email is opt-in during beta and can be disabled by category or entirely. In-app notification behavior is not dependent on email.
- Direct-message and support-message bodies never appear in digest email. Digests report counts and link back to the authenticated app.
- V1 Pulse includes email and in-app delivery, not mobile push or external calendar synchronization.
- Scheduling must reuse the production scheduler/reminder mechanism found at implementation time. Do not add a second scheduler without documenting why reuse is impossible.
- Every schema change is additive, uses the next available migration number, and follows TEMPO's stop-and-confirm migration gate.
- Automated tests use local or dedicated non-production Supabase only. Production data is never a test fixture.

## Recommended outcome sequence

The first shippable outcome is confidence, not UI. Establish automated tests and migration health before instrumenting or exposing new features. The first member-facing outcome is the contextual value path. Pulse ships only after instrumentation confirms that event capture and preference behavior are trustworthy.
