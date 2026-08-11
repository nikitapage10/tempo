# TEMPO — Execution prompt for Activation, Reliability, and Pulse

Use this prompt in the actual TEMPO code repository when ready to implement. Do not paste all work packages into a single coding run; begin with AR-0 and stop at every approval/migration gate.

---
You are implementing TEMPO's Activation, Reliability, and Pulse program.

Read completely before acting:

1. The repository's current `CLAUDE.md` / `AGENTS.md` / equivalent instructions.
2. `PRODUCT.md`, `CHANGELOG.md`, `DATA-MODEL.md`, `TECHNICAL-ARCHITECTURE.md`, `SECURITY-AND-PERMISSIONS.md`, `TESTING-STRATEGY.md`, and `DEPLOYMENT.md`.
3. Calendar product/technical specs and every migration through the latest available number.
4. The four planning documents in the Activation, Reliability, and Pulse specification pack.

Hard rules:

- Work on one AR package at a time in the documented order.
- Start with AR-0 only. Do not install dependencies or write feature code during AR-0.
- Before adding test dependencies, propose exact packages/versions, scripts, CI jobs, expected runtime, and maintenance cost; wait for approval.
- Never point tests, fixtures, cleanup, or destructive operations at production Supabase.
- Detect and abort if the configured test project matches production.
- Preserve the existing stack and reuse current notification, Calendar reminder, Realtime, Resend, admin, and server-only service-role boundaries.
- Inspect the actual schema before choosing names. The planning names are recommended targets, not permission to duplicate existing tables.
- Every database change is additive and uses the next available numbered migration.
- After writing any migration, STOP. Report the filename, purpose, safety properties, and exact Supabase run instructions. Wait for the user to confirm success before dependent code.
- Never drop, truncate, recreate, or retroactively modify applied production schema.
- RLS is authoritative. UI hiding and feature flags are not authorization.
- Do not store or log titles, notes, lyrics, comments, messages, goals, prompts, generated content, filenames, storage paths, signed URLs, email bodies, raw tokens, or secrets in product analytics or delivery logs.
- Activation product behavior derives from authoritative workspace records, not analytics events.
- Direct/support message bodies and private creative text never appear in Pulse email.
- Pulse emails are opt-in, idempotent, suppressible, and reauthorize content immediately before sending.
- No external calendar sync, mobile push, score, streak, or generic feature tour in this program.
- Update version and living documentation only as each package actually ships.
- Run the package's automated and manual verification, then report evidence and remaining risks.

AR-0 required output:

1. Current architecture inventory:
   - Latest migration and applied capability state.
   - Existing notification, realtime, calendar reminder, scheduler, Resend, webhook, admin analytics, and feature-flag mechanisms.
   - Current CI/test dependencies and scripts.
   - Exact production Supabase identifiers that the test guard must reject, reported safely without secrets.
2. Gap analysis against the specification pack.
3. Proposed isolated test environment.
4. Proposed test dependencies and CI shape, but do not install yet.
5. Confirmed package/migration plan using the next available migration numbers.
6. Blocking questions only where the repository cannot answer them.

After the user approves AR-0, implement AR-1 only. Continue package-by-package, honoring every exit gate in `03-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md`.

At the end of each package, report:

- Outcome delivered.
- Files changed.
- Migration status and whether user confirmation is still required.
- Tests run and exact pass/fail counts.
- Manual checks still required.
- Privacy/security checks.
- Rollout state/feature flag.
- Documentation/version updates.
- The next package, without starting it until requested or previously authorized.

---
