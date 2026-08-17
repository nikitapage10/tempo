# TEMPO — instructions for Claude

**Read `.cursorrules` in the repo root before making any change.** It is the
source of truth for stack, design system, database safety, and storage rules.
This file exists because `.cursorrules` is a Cursor convention that Claude Code
does not load automatically — the rules below are the ones most easily missed,
restated so they are always in context.

`cursorrules.txt` is a superseded snapshot. Ignore it.

## REQUIRED before every push — not optional

These don't need to happen after each individual change — do them once,
covering everything since the last push (once per push, in practice once per
day of work), not per commit:

1. **Version bump.** `APP_VERSION` in `lib/version.ts` and `version` in
   `package.json` must both be bumped, and must match each other.
   Still 0.x: patch = bug fix or tiny tweak; minor = new feature or meaningful
   behavior/UI change. Do not bump major.

2. **CHANGELOG.md.** A plain-English entry under a `## YYYY-MM-DD` heading, in
   "Added / Changed / Removed / Fixed: <what it means for the user>" form,
   mentioning the new version, covering everything since the last push. Written
   for a musician, not a developer — no file paths or component names. Add an
   "Under the hood" line only when the user must act (e.g. run a migration).

3. **PRODUCT.md** — update when the product's feature set actually changed.
   It describes TEMPO as it exists today, never the roadmap.

A pre-push hook (`.claude/hooks/check-release-rules.sh`) enforces this at
`git push` time by checking the *whole range* of commits since the last push,
not each commit individually — so commit freely while working, and only do the
version bump / CHANGELOG / PRODUCT.md pass once, right before pushing.
Tooling-only pushes with no app-facing change opt out by putting
`[skip-release-check]` in the commit message — every commit in the push needs
the marker, not just one.

## Working alongside other agents — REQUIRED

This repo has multiple people and multiple agents working at once. **Acquire
an isolated workspace before editing** — do not write in the shared checkout.

```bash
node scripts/agent-workspace.mjs acquire --wait --json
```

That assigns **Workspace 1**, **Workspace 2**, or **Workspace 3**
(`../TEMPO-worktrees/…`). Works the same whether you are in **Cursor**, **Claude
Code**, or **Codex** — one pool, one mutex. If all three are busy, `--wait`
queues until a slot frees. Open the returned folder as your project root, work
on `main` there, stage narrowly (never `git add -A`), rebase before the release
pass, then:

```bash
node scripts/agent-workspace.mjs release --agent-id <id>
```

Read `AGENTS.md` for status, heartbeat, force-clear, and push protocol.

## Other things that bite

- **Never** drop, truncate, or reset tables. The Supabase database holds real
  music data. Schema changes go in numbered `/migrations/*.sql` files for the
  user to run manually — tell them when one needs running.
- Secrets live only in `.env.local` and Vercel env vars. Never commit or print
  them.
- Production is https://mytempo.dev, auto-deployed from `main`.
  Never hardcode localhost in anything that ships.
- Read `docs/WEB-DESKTOP-RELEASE-POLICY.md` for desktop-sensitive work. The
  Electron shell loads the production web app, so shared features ship through
  Vercel. Native and cross-boundary changes follow the separate desktop
  version, compatibility, and public-update-channel rules in that document.
  Mac and Windows desktop must stay feature-parity for the same shell version.
