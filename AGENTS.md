# AGENTS.md — working in this repo alongside other agents

This repo is worked on by multiple people **and** multiple AI coding agents
(Cursor, Claude Code, Codex, others) at the same time. `.cursorrules` is the
full source of truth (stack, design, database safety, release process). This
file covers **how agents share the repo without stepping on each other**.

## Agent workspace pool — REQUIRED before editing

TEMPO uses **three fixed isolated workspaces**, not one shared checkout:

| Slot | Path (next to main repo) |
|------|--------------------------|
| Workspace 1 | `../TEMPO-worktrees/Workspace 1` |
| Workspace 2 | `../TEMPO-worktrees/Workspace 2` |
| Workspace 3 | `../TEMPO-worktrees/Workspace 3` |

Pool state (who holds which slot) lives in
`../TEMPO-worktrees/.agent-pool/state.json` with a directory mutex
(`state.lock`).

### Acquire → work → integrate locally → release

**Every agent, every session, before the first edit:**

```bash
node scripts/agent-workspace.mjs acquire --wait --json
```

1. If a slot is free → you get **Workspace 1**, **2**, or **3** immediately.
2. If all three are busy → `--wait` blocks on the pool mutex and polls every
   2s until a slot frees (default max wait: 2 hours).
3. Move Cursor to the returned root (`move_agent_to_root`) **before** editing.
   Claude Code and Codex: **`cd` to `rootPath`** in that tool's shell instead.
4. Work inside that checkout only.
5. When finished, use the same release command:

```bash
node scripts/agent-workspace.mjs release --agent-id <id-from-acquire>
```

`release` is now the guarded local handoff. It first integrates the slot's
commits and working changes into the primary local `TEMPO` checkout, cleans the
slot, and only then releases the lease. It **never pushes**. If local `TEMPO` is
dirty, not on `main`, diverged, or has a patch collision, release stops and
keeps the slot and lease intact.

Shortcuts:

```bash
npm run agent:workspace          # acquire --wait
npm run agent:workspace:status   # who holds what
npm run agent:workspace:integrate # integrate without releasing
npm run agent:workspace:release  # integrate + release (needs TEMPO_AGENT_ID)
```

Bootstrap worktrees once (or let `acquire` do it):

```bash
node scripts/agent-workspace.mjs ensure
```

### What counts as “busy”

A slot is leased while its **heartbeat is younger than 15 minutes**. The
heartbeat is the only thing that keeps a lease alive. Every CLI call is a
short-lived `node` process, so the recorded `pid` is dead seconds after
`acquire` returns — it is deliberately not used to free a slot. A caller that
owns a genuinely long-lived process can pass `--owner-pid <pid>`; that one is
checked, so a crash frees the slot without waiting out the window.

Stale leases are cleared on the next `acquire`.

Refresh a long session — do this every few minutes, or a second agent takes
your slot 15 minutes in:

```bash
node scripts/agent-workspace.mjs heartbeat --agent-id <id>
```

### A free lease is not the same as an empty desk

`acquire` only hands out a slot whose checkout is **clean**. An agent that
crashed mid-task leaves uncommitted files and a feature branch behind; dropping
the next agent into that folder mixes two people's work. So:

- Slots with uncommitted changes are skipped, and `status` reports them as
  **needs cleanup** with the file count and branch.
- If every free slot is dirty, `acquire` fails fast with the paths rather than
  waiting (waiting cannot clean them) — commit, stash, or clear them, then
  retry. `--allow-dirty` overrides, and shares the desk rather than deleting
  anything.
- A clean slot is checked out at the latest `origin/main` before you get it, so
  nobody starts on a week-old tree. `--no-sync` skips that.
- `--slot "Workspace 2"` asks for a particular slot; you still get a different
  one if it is busy or dirty. Add `--allow-dirty` to deliberately resume that
  exact dirty slot.

Force-clear a stuck slot (human operator only):

```bash
node scripts/agent-workspace.mjs release --slot "Workspace 1" --force
```

### Main `TEMPO` checkout

The primary repo folder is for **you** (the human), read-only inspection, and
the guarded integration command. Agents never edit it directly. A successful
release leaves the completed working changes there for immediate local review.
If you have uncommitted work in primary `TEMPO`, integration refuses to run;
agents must not stash, overwrite, or clean human work.

Cursor's sessionStart hook tries to acquire automatically (waits up to ~2
minutes). If all slots stay busy, follow the hook message and run
`acquire --wait` before editing.

### Cross-tool (Cursor, Claude Code, Codex, others)

The pool is **one shared contract** — not Cursor-specific. Any tool that can
run Node and `git` uses the same CLI and the same three folders:

| Tool | How to participate |
|------|-------------------|
| **Cursor** | sessionStart hook + `move_agent_to_root` to the acquired path |
| **Claude Code** | SessionStart hook in `.claude/settings.json`; `cd` to the acquired path |
| **Codex / others** | Run `node scripts/agent-workspace.mjs acquire --wait --json` before edits; `cd` to `rootPath` |

Cloud/background agents do not share this filesystem and cannot update the
local checkout. They work on a remote branch or PR. After that work reaches
remote `main`, the next foreground Cursor/Claude session fast-forwards the
clean primary local `TEMPO` checkout through the existing start hook.

Optional env vars (all tools):

- `TEMPO_AGENT_TOOL=cursor|claude|codex|other` — label shown in `status`
- `TEMPO_AGENT_ID=<uuid>` — so `npm run agent:workspace:release` finds your lease
- `TEMPO_AGENT_TASK=...` — short note stored on the lease

Leases track **process id + heartbeat**, not which IDE owns the window — so
Claude and Codex sessions queue the same way Cursor does when all three slots
are full.

## Finish protocol (inside your workspace)

Same release rules as always — scoped to **your** slot:

1. Inspect your changes and keep them limited to the requested task.
2. **Do not commit or push unless the user explicitly asks.**
3. Complete the version bump (`lib/version.ts` + `package.json`), CHANGELOG,
   PRODUCT.md if the feature set changed.
4. Validate: `npx tsc --noEmit` and `npm test`.
5. Run `release --agent-id <id>`. It integrates locally, cleans the slot, and
   frees the lease only after success.
6. If integration blocks, report the exact reason and keep both checkouts.

When the user explicitly requests a commit or push, follow the repository's
normal Git safety protocol first; local integration still happens before the
lease is released.

CHANGELOG conflicts: keep both agents' bullets under the shared date heading.

## The failure mode this prevents

Two agents in one directory each bump version/CHANGELOG from stale `main`,
stage each other's files, or push over each other. Isolated workspaces plus
the pool mutex cap concurrency at three writers and queue a fourth.

## Housekeeping

Only these three worktrees should exist under `../TEMPO-worktrees/`. Do not
add ad-hoc task folders. If old `TEMPO-worktrees/<task-name>` folders remain
from before this protocol, remove them after confirming they are merged and
clean:

```bash
git worktree list
git worktree remove <path>
git worktree prune
```

## Where the rest of the rules live

- `.cursorrules` — stack, design system, database/storage safety, release
  checklist, and this pool as the default concurrency model.
- `.cursor/rules/agent-workspaces.mdc` — Cursor-specific acquire/release
  reminder (always on).
- `CLAUDE.md` — release + pool summary for Claude Code.
- `docs/WEB-DESKTOP-RELEASE-POLICY.md` — desktop-sensitive work.
