# TEMPO — Implementation Plan

*Living document. Do not combine packages. Do not skip migration gates.*

**Current execution track:** Team Operations v1 is implemented in migrations 101–105 and the shared web client. Follow `TEAM-OPERATIONS-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md` for staged schema rollout and the direct hosted RLS gate.
**Historical track:** The Prompt 0 → Prompt 12 sequence below built the earlier track-workspace foundation and is retained for dependency history, not as the next backlog.

### Team Operations package order

1. Permission truth
2. Membership lifecycle and informed invitations
3. Task assignments
4. My Work v1
5. Review requests
6. Artist Team Brief
7. Artist team room
8. Pro operations home
8A. Optional role-based Pro starter kits
9. Delegated Team/Social administration only after separate approval

The five binding documents are `TEAM-OPERATIONS-PRODUCT-SPEC.md`, `TEAM-OPERATIONS-UX-SPEC.md`, `TEAM-OPERATIONS-TECHNICAL-DESIGN.md`, `TEAM-OPERATIONS-SECURITY-AND-PERMISSIONS.md`, and `TEAM-OPERATIONS-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md`.

---

## 0. Global rules

1. One work package at a time; manually test; deploy successfully before the next.
2. Commit after each successful package so regressions can be isolated.
3. Never drop/truncate/recreate production tables.
4. After generating any migration: **STOP**. User runs SQL in Supabase and confirms. Only then continue app code that depends on it.
5. Do not combine collaboration/RLS (Prompt 10) with unrelated visual refactors.
6. Bump `package.json` + `lib/version.ts`; update CHANGELOG + PRODUCT (PRODUCT only for shipped UX); update living specs.
7. Run `npm run build` before considering a package done.

### Do-not-proceed gate (migrations)

```
┌─ Agent writes migrations/NNN_*.sql + updates schema.sql/types stubs as specified
│
├─ Agent STOPS and prints: filename + paste-into-Supabase instructions
│
├─ User runs migration in Supabase SQL Editor
│
├─ User replies: “migration NNN succeeded” (or paste errors)
│
└─ Only then: agent continues application implementation for that prompt
```

If migration fails: fix SQL in a **new** incremental file or corrected file per user instruction — never “reset the DB.”

---

## Package order and dependencies

| # | Package | DB migration | Depends on | Ships user-visible? |
|---|---------|--------------|------------|---------------------|
| 0 | Living specs | None | — | Docs only |
| 1 | Track workspace foundation | None | 0 | Layout redesign |
| 2 | Next move / blockers / signals | `001_track_workflow.sql` | 1 (layout targets) | Yes |
| 3 | Timestamped comments | `002_timestamped_comments.sql` | 1–2 | Yes |
| 4 | Guest feedback links | `003_guest_review_links.sql` | 3 (+ security docs) | Yes |
| 5 | Milestones, decisions, blind A/B | `004_version_milestones_and_decisions.sql` | 1, 3–4 for delete safety | Yes |
| 6 | Stage recipes | `005_stage_recipes.sql` | 2 (workflow fields), stage CRUD | Yes |
| 7 | Focus sessions | `006_focus_sessions.sql` | 1–2; refs later optional | Yes |
| 8 | Reference board | `007_track_references.sql` | 1; focus integration w/ 7 | Yes |
| 9 | Release workspace | `008_release_workspace.sql` | projects; decisions/milestones ideal | Yes |
| 10 | Collaboration, activity, notifications | `009_track_collaboration.sql` | **plan approval gate**; 3–8 tables | Yes — high risk |
| 11 | Workspace layout presets | `010_workspace_preferences.sql` | 1 + modules from 3–10 | Yes |
| 12 | Today/Board integration polish | optional `011_dashboard_aggregates.sql` | 1–11 | Yes |
| 13 | Automated tests (optional) | None | 12 stable; **deps approval** | Dev only |

### Dependency notes
- **Prompt 1 before 2:** strip/panel targets need the new shell.
- **Prompt 3 before 4:** guest comments extend comments model.
- **Prompt 4 before 5 delete rules:** guest links affect version delete.
- **Prompt 5 pruning before heavy upload UX assumptions in later packs.**
- **Prompt 6 needs centralized stage transition** used by Board + timeline.
- **Prompt 8 after 7** preferred for focus reference selection; if 8 precedes 7, focus integration waits.
- **Prompt 10** blocks on explicit chat approval of permissions matrix before SQL/code.
- **Prompt 12** must not invent major new models; aggregates only if measured need.

---

## Migration order and rollback approach

### Order
`001` → `002` → `003` → `004` → `005` → `006` → `007` → `008` → `009` → `010` → optional `011`

### Rollback philosophy
Postgres has no automatic down migrations in this project. Prefer:

1. **Forward-fix** additive columns (nullable) and new tables.
2. If app must roll back: deploy previous Vercel build that does not require new columns (columns remain unused — safe).
3. Dangerous rollbacks (drop column/table) are **out of policy** on production unless the user explicitly orders a careful manual SQL and accepts data loss.
4. Feature flags are not in stack — use “UI not shipped” + nullable columns.

### Service-role / env (Prompt 4)
User must set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and Vercel **before** guest routes work. Document in DEPLOYMENT.md. Gate: do not enable public review UI until env confirmed.

---

## Per-package verification checkpoints

### Prompt 0
- [ ] Seven docs exist; `.cursorrules` references them
- [ ] PRODUCT.md still describes only current features
- [ ] CHANGELOG notes specs added; build passes; version bumped

### Prompt 1
- [x] Desktop/mobile layout; tabs keyboard; stage confirm skip; tint fallback; all prior track functions work
- [x] No DB changes

### Prompt 2
- [ ] Migration 001 confirmed
- [ ] `stage_entered_at` updates only on stage change
- [ ] Strip/editor; Board/Today signals; optimistic rollback

### Prompt 3
- [x] Migration 002 confirmed
- [x] Markers + list; multi-version comments; counts; delete confirm mentions comments

### Prompt 4
- [x] Migration 003 + service role configured
- [ ] Security checklist: token states, download flags, API tampering, private routes still gated — pending manual verification pass (see TESTING-STRATEGY.md)

### Prompt 5
- [ ] Migration 004 confirmed
- [ ] Pin prune matrix; current safety; A/B randomize; delete blockers for guest links

### Prompt 6
- [ ] Migration 005 confirmed
- [ ] Preview/automatic/skip/partial retry; no duplicate on remount; Board + timeline both trigger

### Prompt 7
- [ ] Migration 006 confirmed
- [ ] Timer across refresh; single active session; 24h recovery; old sessions readable

### Prompt 8
- [ ] Migration 007 confirmed
- [ ] Playback coordinator; URL validation; missing asset state

### Prompt 9
- [ ] Migration 008 confirmed
- [ ] General vs release types; metadata export; readiness transparent

### Prompt 10
- [ ] Chat plan approved → migration 009 → **test on non-production account first**
- [ ] Full RLS matrix checklist; unauthorized access = release blocker

### Prompt 11
- [ ] Migration 010 confirmed
- [ ] Preset precedence; preference isolation between users

### Prompt 12
- [ ] Regression + role + mobile/PWA checklists
- [ ] Optional 011 only if needed
- [ ] Live URL verification sequence after deploy

### Prompt 13
- [ ] Test stack approved before adding dependencies
- [ ] Never point tests at production DB

---

## Suggested git cadence
After each package: commit with clear message (“track workspace shell”, “guest review links”, etc.). Prefer merge to `main` only after manual checklist + preview if risky (especially Prompt 10).

---

## Explicitly out of order (do not do)
- Implementing Prompt 4 guest public RLS “for convenience”
- Starting Prompt 10 SQL before the permissions plan is approved in chat
- Adding email providers during Prompt 10 notifications
- Building a freeform dashboard builder in Prompt 11
- Fake AI scoring in Prompt 2 or 12
