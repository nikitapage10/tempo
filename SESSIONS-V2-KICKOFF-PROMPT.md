# SESSIONS V2 — KICKOFF PROMPT

Paste this into a fresh coding session (Claude Code, Cursor, or Codex) to start the work.
Replace `WP0` with whichever work package is next.

---

```
Read .cursorrules and CLAUDE.md first, then these specs in the repo root:

  SESSIONS-V2-PRODUCT-SPEC.md          what Sessions becomes and why
  SESSIONS-V2-UX-DESIGN.md             layout, components, motion, copy rules
  SESSIONS-V2-TECHNICAL-DESIGN.md      data model, routes, transport protocol
  CALLS-PLATFORM-DESIGN.md             calls as an app-wide capability
  SESSIONS-V2-SECURITY-AND-PERMISSIONS.md   guest boundary, RLS, AI cost, privacy
  SESSIONS-V2-IMPLEMENTATION-PLAN.md   the work packages and their order

Implement **WP0** from the implementation plan, and only WP0. Do not start the next
package, and do not widen the scope while you are in there.

Before you edit anything:
  node scripts/agent-workspace.mjs acquire --wait --json
Work only in the workspace it returns. A fresh workspace needs `npm ci`, plus
.env.test.local and test/support/fixtures.json copied from C:\Users\nikit\Documents\TEMPO
or the tests fail for the wrong reason.

Rules that matter here:
- Stage narrowly by path. Never `git add -A`; other agents' files are in the same tree.
- The database holds real music data. Schema changes are new numbered files in
  /migrations for the user to run by hand, additive only, and you tell them when one
  needs running.
- No em dashes in any user-facing copy.
- Guests never receive audio of a bounce. This is not a setting.
- Before pushing: `npx tsc --noEmit`, `npm test`, `npm run build`. Three pre-existing
  type errors in test/unit/agent-workspaces.test.ts are expected; anything else is yours.
- Release pass once per push, after rebasing on origin/main: bump APP_VERSION in
  lib/version.ts and version in package.json to match, add a plain-English CHANGELOG.md
  entry under today's date, and update PRODUCT.md only if the feature set actually
  changed.
- Push to main when it is green, then release the workspace slot.

When you are done, give me: what shipped, the manual checks I should run, and any
migration I need to run in Supabase.
```

---

## Shorter version, for a package that is already understood

```
Acquire a workspace (node scripts/agent-workspace.mjs acquire --wait --json), then
implement WP<N> from SESSIONS-V2-IMPLEMENTATION-PLAN.md exactly as written. Follow the
release rules in .cursorrules before pushing to main. Report what shipped, what I should
test by hand, and any migration to run.
```

## If you are picking up mid-stream

```
Check `git log --oneline -15` and CHANGELOG.md to see which work packages already shipped,
then continue from the first unfinished one in SESSIONS-V2-IMPLEMENTATION-PLAN.md. Confirm
with me which package you think is next before writing code.
```
