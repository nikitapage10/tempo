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

## The protocol — work in place, on `main`

The default is **one working directory, one branch: `main`, no new folders.**
An extra worktree is an exception you have to justify, not the starting move
(see "When a worktree is actually warranted"). Rebasing gives you the same
protection against a stale version bump that a throwaway push worktree did,
without leaving a directory behind.

1. **Work in the repo you're already in, on `main`.** Don't create a task
   branch or a task folder for ordinary work. Before you commit, confirm the
   branch is still what you think it is — another agent can switch it under
   you mid-task:
   ```
   git branch --show-current
   ```
   If it isn't `main`, stop and look at what else is going on before
   committing anything.

2. **Stage narrowly.** Never `git add -A` — this directory carries other
   agents' and the user's stray files. Run `git status` first and stage only
   the paths your change actually produced, explicitly, by name. If a shared
   file (CHANGELOG.md, PRODUCT.md, package.json, lib/version.ts) already has
   *someone else's* uncommitted edits mixed into it, don't blindly overwrite
   it — either edit only your own lines, or stage an isolated blob for just
   your change (`git hash-object -w` + `git update-index --cacheinfo`) so
   their pending edit stays intact in the working tree, uncommitted, for them
   to land later.

3. **Don't decide your version number until you're actually pushing.**
   Mid-task, don't hardcode "this will be v0.104.0." Commit your work first,
   *then* sync in place:
   ```
   git fetch origin
   git rebase origin/main
   ```
   Only now do the release pass — version bump, CHANGELOG entry, PRODUCT.md —
   against what `origin/main` actually is at this moment. That's the whole
   reason the old protocol spun up a scratch worktree; an in-place rebase
   achieves it, and leaves nothing behind. A CHANGELOG conflict is normal and
   easy: keep both sides' bullets under the shared `## YYYY-MM-DD` heading —
   never delete another agent's entry to make yours fit.

4. **Validate after the rebase, not before.** `npx tsc --noEmit` and
   `npm test` on the rebased state — that's the state you're actually
   landing on. `node_modules` is already installed here, which is one more
   reason not to spin up a fresh worktree for this.

5. **Push only your own commits.** `git log origin/main..HEAD` before pushing;
   if it lists work that isn't yours, sort that out rather than pushing it.

6. **Leave the directory as you found it** — don't discard another agent's
   uncommitted changes, and don't commit their stray untracked files.

## When a worktree *is* actually warranted

Only two cases:

- Another agent has uncommitted tracked changes in this directory that
  overlap the files you need to edit, so you genuinely can't work here.
- You need two checkouts live at once (comparing old vs new behaviour, or a
  long build running while you keep editing).

If you hit one of those:

```
git worktree add ../TEMPO-worktrees/<short-task-name> -b <branch-name> origin/main
```

- Everything goes under the single `TEMPO-worktrees/` container — never
  loose folders next to the repo.
- One worktree per task, and **never** a second one just to push from.
- Remove it the moment the work has landed; a merged worktree left on disk is
  a bug, not a record:
  ```
  git worktree remove ../TEMPO-worktrees/<short-task-name>
  git branch -d <branch-name>
  ```

## Housekeeping

If worktrees have piled up, this lists every one that is clean and whose
commits are all already in `origin/main` — i.e. safe to delete:

```bash
git fetch origin && git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //' | while read -r wt; do [ "$(git -C "$wt" rev-parse --git-common-dir)" = "$(git -C "$wt" rev-parse --git-dir)" ] && continue; [ -z "$(git -C "$wt" status --porcelain)" ] && [ -z "$(git -C "$wt" cherry origin/main HEAD | grep '^+')" ] && echo "$wt"; done
```

Remove them with `git worktree remove`, then `git worktree prune` and
`git branch -d` the merged branches.

## Where the rest of the rules live

- `.cursorrules` — stack, design system, database/storage safety, the
  release checklist (version bump + CHANGELOG.md + PRODUCT.md), and this same
  concurrency protocol.
- `CLAUDE.md` — the subset of `.cursorrules` most easily missed by Claude
  Code specifically, since it doesn't auto-load `.cursorrules`.
- `docs/WEB-DESKTOP-RELEASE-POLICY.md` — required reading before touching
  `electron/` or anything cross-boundary between the web app and desktop shell.
