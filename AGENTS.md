# AGENTS.md — working in this repo alongside other agents

This repo is worked on by multiple people **and** multiple AI coding agents
(Claude Code, Cursor, Codex, others) at the same time — sometimes in the same
checked-out working directory. `.cursorrules` is this project's full source
of truth (stack, design system, database safety, release process); read it
before making changes. This file covers only the concurrency problem: how to
avoid stepping on other agents' in-progress work and how to get your own
change to `main` cleanly.

## The failure mode this protects against

Two agents work at once. Each bumps `APP_VERSION` / `package.json` `version`
and adds a CHANGELOG entry based on whatever `main` looked like when *they*
started. Both finish, both push. Whoever pushes second either overwrites the
first agent's version bump, or — if working directly in a shared directory —
ends up committing on top of a branch/commit they never reviewed, because the
checked-out branch changed under them mid-task.

## The protocol

1. **Work in your own `git worktree`, on your own branch off `main`.**
   ```
   git worktree add ../TEMPO-<short-task-name> -b <branch-name> origin/main
   ```
   Do your work there. Never assume a shared working directory's checked-out
   branch is stable — another agent can switch it. Before you commit, always
   confirm: `git branch --show-current`.

2. **Stage narrowly.** Never `git add -A` in a directory other agents might
   also be touching. Run `git status` first; stage only the files your change
   actually produced. If a shared file (CHANGELOG.md, PRODUCT.md,
   package.json, lib/version.ts) already has *someone else's* uncommitted
   edits mixed into it, don't blindly overwrite it — either edit only your
   own lines, or stage an isolated blob for just your change
   (`git hash-object -w` + `git update-index --cacheinfo`) so their pending
   edit stays intact in the working tree, uncommitted, for them to land later.

3. **Don't decide your version number until you're actually pushing.**
   Mid-task, don't hardcode "this will be v0.104.0." At push time:
   ```
   git fetch origin
   git worktree add ../TEMPO-push origin/main   # fresh, isolated
   cd ../TEMPO-push
   git cherry-pick <your-commit-sha>            # or rebase your branch here
   ```
   Resolve the version bump and the CHANGELOG entry's position against
   what `origin/main` *actually* is right now, not against a stale mental
   model. A CHANGELOG conflict is normal and easy: keep both sides' bullets
   under the shared `## YYYY-MM-DD` heading — never delete another agent's
   entry to make yours fit.

4. **Validate in that fresh worktree, not your stale one.** `npm install`
   (worktrees don't share `node_modules`), then `npx tsc --noEmit` and
   `npm test` before pushing. A push should be validated against the state
   it's actually landing on.

5. **Push only your own rebased/cherry-picked commit(s)** — never push a
   branch that still carries another agent's unfinished, unreviewed commits
   just because it happened to be the branch you built on top of.

6. **Clean up.** `git worktree remove ../TEMPO-push` once pushed. Leave the
   original shared working directory exactly as you found it — don't discard
   another agent's uncommitted changes there.

## One local preview across every agent and worktree

Read `LOCAL-DEVELOPMENT.md` before opening TEMPO locally. The only human-review
URL is `http://localhost:3000`.

- Run `npm run dev` to start or reuse it. Never run `next dev` directly and
  never choose or accept a fallback port.
- When starting it, use the tool's approved network-capable execution mode.
  A sandboxed server cannot authenticate with or load live data from Supabase.
- Run `npm run dev:status` before telling the user a local preview is ready;
  report the branch it is actually serving.
- Run `npm run dev:switch` only when the user asks to review your worktree.
  Starting a task does not authorize replacing the branch currently on screen.
- Worktrees inherit the primary checkout's `.env.local` through the preview
  coordinator. Never copy or expose that file.
- `DEV_PREVIEW_EMAIL` enables the loopback-only session path so local agent
  browsers do not need the user's password. It belongs only in `.env.local`,
  never in source control or Vercel.

## Where the rest of the rules live

- `.cursorrules` — stack, design system, database/storage safety, the
  release checklist (version bump + CHANGELOG.md + PRODUCT.md), and this same
  concurrency protocol.
- `CLAUDE.md` — the subset of `.cursorrules` most easily missed by Claude
  Code specifically, since it doesn't auto-load `.cursorrules`.
- `docs/WEB-DESKTOP-RELEASE-POLICY.md` — required reading before touching
  `electron/` or anything cross-boundary between the web app and desktop shell.
