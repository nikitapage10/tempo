/**
 * Three-slot workspace pool for multi-agent dev on TEMPO.
 * Slots: Workspace 1, Workspace 2, Workspace 3.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export const WORKSPACE_SLOTS = [
  "Workspace 1",
  "Workspace 2",
  "Workspace 3",
];

export const HEARTBEAT_STALE_MS = 15 * 60 * 1000;
export const WAIT_POLL_MS = 2_000;
export const DEFAULT_MAX_WAIT_MS = 2 * 60 * 60 * 1000;
export const STATE_LOCK_RETRY_MS = 200;
export const STATE_LOCK_MAX_MS = 30_000;

/** Known agent tools — pool is tool-agnostic; label leases for status/debug. */
export const AGENT_TOOLS = ["cursor", "claude", "codex", "other"];

/**
 * Resolve which coding agent holds a lease. Tool-agnostic: same pool for
 * Cursor, Claude Code, Codex, and anything else that runs the CLI.
 *
 * Set explicitly with --tool or TEMPO_AGENT_TOOL. Otherwise best-effort detect
 * from common env vars each tool sets in its shell.
 */
export function resolveAgentTool(explicit) {
  if (explicit?.trim()) return explicit.trim().toLowerCase();
  if (process.env.TEMPO_AGENT_TOOL?.trim()) {
    return process.env.TEMPO_AGENT_TOOL.trim().toLowerCase();
  }
  if (process.env.CLAUDE_CODE === "1" || process.env.CLAUDE_PROJECT_DIR) {
    return "claude";
  }
  if (process.env.CODEX_SANDBOX || process.env.OPENAI_CODEX) {
    return "codex";
  }
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_AGENT) {
    return "cursor";
  }
  return "other";
}

function resolveWorktreesRoot(mainRepoRoot, override) {
  if (override) return path.resolve(override);
  return path.resolve(mainRepoRoot, "..", "TEMPO-worktrees");
}

export function getWorktreesRoot(mainRepoRoot, override) {
  return resolveWorktreesRoot(mainRepoRoot, override);
}

export function getPoolDir(mainRepoRoot, worktreesRoot) {
  return path.join(
    resolveWorktreesRoot(mainRepoRoot, worktreesRoot),
    ".agent-pool",
  );
}

export function getStatePath(mainRepoRoot, worktreesRoot) {
  return path.join(getPoolDir(mainRepoRoot, worktreesRoot), "state.json");
}

export function getStateLockPath(mainRepoRoot, worktreesRoot) {
  return path.join(getPoolDir(mainRepoRoot, worktreesRoot), "state.lock");
}

export function getSlotPath(mainRepoRoot, slot, worktreesRoot) {
  return path.join(resolveWorktreesRoot(mainRepoRoot, worktreesRoot), slot);
}

export function emptyPoolState() {
  return { version: 1, slots: {} };
}

export function readPoolState(mainRepoRoot, worktreesRoot) {
  const statePath = getStatePath(mainRepoRoot, worktreesRoot);
  if (!fs.existsSync(statePath)) {
    return emptyPoolState();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (parsed?.version !== 1 || typeof parsed.slots !== "object") {
      return emptyPoolState();
    }
    return parsed;
  } catch {
    return emptyPoolState();
  }
}

function writePoolState(mainRepoRoot, state, worktreesRoot) {
  const poolDir = getPoolDir(mainRepoRoot, worktreesRoot);
  fs.mkdirSync(poolDir, { recursive: true });
  const statePath = getStatePath(mainRepoRoot, worktreesRoot);
  const tmp = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, statePath);
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isLeaseStale(lease, nowMs = Date.now()) {
  const heartbeat = Date.parse(lease.lastHeartbeatAt);
  if (!Number.isFinite(heartbeat)) return true;
  return nowMs - heartbeat > HEARTBEAT_STALE_MS;
}

/**
 * A lease is alive while its heartbeat is fresh.
 *
 * The heartbeat is authoritative, NOT `lease.pid`. Every CLI invocation is a
 * short-lived `node` process that exits the moment it prints its result, so
 * `pid` is dead within milliseconds of a successful `acquire` — treating a dead
 * pid as a free slot handed the same workspace to the next agent immediately
 * and let two agents edit one checkout.
 *
 * A caller that really does own a long-lived process (an editor session, a
 * shell wrapper) can record it as `ownerPid`; that one is checked, so a crashed
 * owner frees its slot without waiting out the heartbeat window.
 */
export function isLeaseActive(lease, nowMs = Date.now()) {
  if (isLeaseStale(lease, nowMs)) return false;
  if (
    Number.isInteger(lease.ownerPid) &&
    lease.ownerPid > 0 &&
    !isProcessAlive(lease.ownerPid)
  ) {
    return false;
  }
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class PoolStateLock {
  constructor(mainRepoRoot, worktreesRoot) {
    this.mainRepoRoot = mainRepoRoot;
    this.worktreesRoot = worktreesRoot;
    this.lockPath = getStateLockPath(mainRepoRoot, worktreesRoot);
    this.held = false;
    this.token = null;
    fs.mkdirSync(path.dirname(this.lockPath), { recursive: true });
  }

  async acquire(maxWaitMs = STATE_LOCK_MAX_MS) {
    const started = Date.now();
    while (Date.now() - started < maxWaitMs) {
      try {
        this.token = randomUUID();
        fs.mkdirSync(this.lockPath);
        fs.writeFileSync(
          path.join(this.lockPath, "owner.json"),
          JSON.stringify({
            pid: process.pid,
            token: this.token,
            at: new Date().toISOString(),
          }),
          "utf8",
        );
        this.held = true;
        return true;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        this.reapStaleLock();
        await sleep(STATE_LOCK_RETRY_MS);
      }
    }
    return false;
  }

  release() {
    if (!this.held) return;
    try {
      const ownerPath = path.join(this.lockPath, "owner.json");
      if (this.token && fs.existsSync(ownerPath)) {
        const owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
        if (owner.token === this.token) {
          fs.rmSync(this.lockPath, { recursive: true, force: true });
        }
      }
    } catch {
      // Best effort.
    } finally {
      this.held = false;
      this.token = null;
    }
  }

  reapStaleLock() {
    const ownerPath = path.join(this.lockPath, "owner.json");
    if (!fs.existsSync(ownerPath)) {
      try {
        fs.rmSync(this.lockPath, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
      if (!owner.pid || !isProcessAlive(owner.pid)) {
        fs.rmSync(this.lockPath, { recursive: true, force: true });
      }
    } catch {
      try {
        fs.rmSync(this.lockPath, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

function runGit(cwd, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    input: options.input,
    stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    shell: false,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return {
    ok: result.status === 0,
    stdout: options.trim === false ? stdout : stdout.trim(),
    stderr: options.trim === false ? stderr : stderr.trim(),
    code: result.status,
  };
}

/**
 * Find the primary checkout even when this script is running from a linked
 * worktree. All linked worktrees share the primary checkout's .git directory.
 */
export function resolveMainRepoRoot(fromPath = process.cwd()) {
  const probe = path.resolve(fromPath);
  const commonDir = runGit(probe, ["rev-parse", "--git-common-dir"]);
  if (!commonDir.ok || !commonDir.stdout) return probe;
  const resolvedCommonDir = path.resolve(probe, commonDir.stdout);
  return path.basename(resolvedCommonDir).toLowerCase() === ".git"
    ? path.dirname(resolvedCommonDir)
    : probe;
}

function listWorktreePaths(mainRepoRoot) {
  const listed = runGit(mainRepoRoot, ["worktree", "list", "--porcelain"]);
  if (!listed.ok) return new Set();
  const paths = new Set();
  for (const line of listed.stdout.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      paths.add(path.resolve(line.slice("worktree ".length).trim()));
    }
  }
  return paths;
}

function pruneDeadLeases(state) {
  const next = { version: 1, slots: {} };
  for (const slot of WORKSPACE_SLOTS) {
    const lease = state.slots[slot];
    if (lease && isLeaseActive(lease)) {
      next.slots[slot] = lease;
    }
  }
  return next;
}

export function ensureWorktrees(mainRepoRoot, worktreesRoot) {
  const wtRoot = resolveWorktreesRoot(mainRepoRoot, worktreesRoot);
  fs.mkdirSync(wtRoot, { recursive: true });
  const existing = listWorktreePaths(mainRepoRoot);
  runGit(mainRepoRoot, ["fetch", "--quiet", "origin"]);

  const commitCandidates = ["origin/main", "main", "HEAD"];

  for (const slot of WORKSPACE_SLOTS) {
    const resolved = path.resolve(getSlotPath(mainRepoRoot, slot, worktreesRoot));
    if (existing.has(resolved) && fs.existsSync(resolved)) {
      continue;
    }
    if (fs.existsSync(resolved)) {
      throw new Error(
        `Path exists but is not a registered worktree: ${resolved}`,
      );
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });

    let created = false;
    for (const commitish of commitCandidates) {
      const attempt = runGit(mainRepoRoot, [
        "worktree",
        "add",
        "--detach",
        resolved,
        commitish,
      ]);
      if (attempt.ok) {
        created = true;
        break;
      }
    }
    if (!created) {
      throw new Error(`Failed to create ${slot} at ${resolved}`);
    }
  }
}

/**
 * What is actually sitting in a slot folder right now.
 *
 * A free lease is not the same thing as an empty desk: an agent that crashed,
 * or was killed mid-task, leaves uncommitted files and a feature branch behind.
 * Handing that slot to the next agent silently mixes two people's work, so
 * `acquire` skips a slot whose checkout is dirty.
 */
export function inspectSlotWorktree(rootPath) {
  if (!fs.existsSync(rootPath) || !fs.existsSync(path.join(rootPath, ".git"))) {
    return { exists: false, clean: true, dirtyCount: 0, branch: null, head: null };
  }
  const status = runGit(rootPath, ["status", "--porcelain"]);
  if (!status.ok) {
    return {
      exists: true,
      clean: false,
      unreadable: true,
      dirtyCount: 0,
      branch: null,
      head: null,
    };
  }
  const dirty = status.stdout ? status.stdout.split(/\r?\n/).filter(Boolean) : [];
  return {
    exists: true,
    clean: dirty.length === 0,
    dirtyCount: dirty.length,
    dirtySample: dirty.slice(0, 5).map((line) => line.slice(3)),
    branch: runGit(rootPath, ["branch", "--show-current"]).stdout || null,
    head: runGit(rootPath, ["rev-parse", "--short", "HEAD"]).stdout || null,
  };
}

/**
 * Put a clean slot on the newest main before the agent starts, so nobody
 * begins work on a checkout that is a week behind. Never touches a dirty slot,
 * and never fails an acquire: a stale worktree is worth a warning, not a block.
 */
export function syncSlotToMain(mainRepoRoot, rootPath) {
  const state = inspectSlotWorktree(rootPath);
  if (!state.exists) return { synced: false, reason: "missing" };
  if (!state.clean) return { synced: false, reason: "dirty" };
  runGit(mainRepoRoot, ["fetch", "--quiet", "origin"]);
  for (const commitish of ["origin/main", "main"]) {
    const attempt = runGit(rootPath, ["checkout", "--detach", commitish]);
    if (attempt.ok) {
      return {
        synced: true,
        at: runGit(rootPath, ["rev-parse", "--short", "HEAD"]).stdout || null,
        from: commitish,
      };
    }
  }
  return { synced: false, reason: "checkout_failed" };
}

export function getWorkspaceStatus(mainRepoRoot, nowMs = Date.now(), worktreesRoot) {
  const state = readPoolState(mainRepoRoot, worktreesRoot);
  return WORKSPACE_SLOTS.map((slot) => {
    const rootPath = getSlotPath(mainRepoRoot, slot, worktreesRoot);
    const lease = state.slots[slot] ?? null;
    const active = lease ? isLeaseActive(lease, nowMs) : false;
    const worktree = inspectSlotWorktree(rootPath);
    return {
      slot,
      rootPath,
      available: !active,
      lease: active ? lease : null,
      stale: Boolean(lease && !active),
      worktree,
      /** Free lease AND an empty desk — the only slots `acquire` hands out. */
      ready: !active && worktree.clean,
    };
  });
}

/**
 * Free slots in preference order: the requested slot first, then the rest in
 * fixed order. Dirty slots come last so they are only ever chosen deliberately.
 */
function rankFreeSlots(state, mainRepoRoot, worktreesRoot, preferred, nowMs = Date.now()) {
  const free = WORKSPACE_SLOTS.filter((slot) => {
    const lease = state.slots[slot];
    return !lease || !isLeaseActive(lease, nowMs);
  });
  const ordered = preferred && free.includes(preferred)
    ? [preferred, ...free.filter((slot) => slot !== preferred)]
    : free;
  return ordered.map((slot) => ({
    slot,
    worktree: inspectSlotWorktree(getSlotPath(mainRepoRoot, slot, worktreesRoot)),
  }));
}

export async function acquireWorkspace(options = {}) {
  const mainRepoRoot = path.resolve(options.mainRepoRoot ?? process.cwd());
  const worktreesRoot = options.worktreesRoot;
  const wait = options.wait ?? false;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const ensure = options.ensure ?? true;
  const agentId = options.agentId ?? randomUUID();
  const preferredSlot = options.slot ?? null;
  const allowDirty = options.allowDirty ?? false;
  const sync_ = options.sync ?? true;
  const started = Date.now();

  if (preferredSlot && !WORKSPACE_SLOTS.includes(preferredSlot)) {
    throw new Error(
      `Invalid slot "${preferredSlot}". Expected one of: ${WORKSPACE_SLOTS.join(", ")}`,
    );
  }

  if (ensure) {
    ensureWorktrees(mainRepoRoot, worktreesRoot);
  }

  while (true) {
    const lock = new PoolStateLock(mainRepoRoot, worktreesRoot);
    const gotLock = await lock.acquire();
    if (!gotLock) {
      return {
        ok: false,
        reason: "interrupted",
        waitedMs: Date.now() - started,
        slots: getWorkspaceStatus(mainRepoRoot, Date.now(), worktreesRoot),
      };
    }

    try {
      const pruned = pruneDeadLeases(readPoolState(mainRepoRoot, worktreesRoot));
      const candidates = rankFreeSlots(
        pruned,
        mainRepoRoot,
        worktreesRoot,
        preferredSlot,
      );
      const preferred = candidates[0]?.slot === preferredSlot
        ? candidates[0]
        : undefined;
      const chosen =
        (allowDirty && preferred ? preferred : undefined) ??
        candidates.find((entry) => entry.worktree.clean) ??
        (allowDirty ? candidates[0] : undefined);

      if (chosen) {
        const slot = chosen.slot;
        const rootPath = getSlotPath(mainRepoRoot, slot, worktreesRoot);
        const now = new Date().toISOString();
        pruned.slots[slot] = {
          agentId,
          pid: process.pid,
          ownerPid: options.ownerPid,
          tool: resolveAgentTool(options.tool),
          claimedAt: now,
          lastHeartbeatAt: now,
          task: options.task,
          rootPath,
        };
        writePoolState(mainRepoRoot, pruned, worktreesRoot);
        const sync =
          sync_ && chosen.worktree.clean
            ? syncSlotToMain(mainRepoRoot, rootPath)
            : { synced: false, reason: chosen.worktree.clean ? "skipped" : "dirty" };
        return {
          ok: true,
          slot,
          rootPath,
          agentId,
          waitedMs: Date.now() - started,
          worktree: chosen.worktree,
          sync,
        };
      }

      // Every free slot has someone's uncommitted work in it. Waiting will not
      // clear that, so say which slot and what is in it instead of blocking.
      if (candidates.length > 0) {
        writePoolState(mainRepoRoot, pruned, worktreesRoot);
        return {
          ok: false,
          reason: "free_slots_dirty",
          waitedMs: Date.now() - started,
          dirtySlots: candidates.map((entry) => ({
            slot: entry.slot,
            rootPath: getSlotPath(mainRepoRoot, entry.slot, worktreesRoot),
            ...entry.worktree,
          })),
          slots: getWorkspaceStatus(mainRepoRoot, Date.now(), worktreesRoot),
        };
      }
      writePoolState(mainRepoRoot, pruned, worktreesRoot);
    } finally {
      lock.release();
    }

    if (!wait) {
      return {
        ok: false,
        reason: "all_busy",
        waitedMs: Date.now() - started,
        slots: getWorkspaceStatus(mainRepoRoot, Date.now(), worktreesRoot),
      };
    }

    if (maxWaitMs > 0 && Date.now() - started >= maxWaitMs) {
      return {
        ok: false,
        reason: "timeout",
        waitedMs: Date.now() - started,
        slots: getWorkspaceStatus(mainRepoRoot, Date.now(), worktreesRoot),
      };
    }

    await sleep(WAIT_POLL_MS);
  }
}

export async function releaseWorkspace(options = {}) {
  const mainRepoRoot = path.resolve(options.mainRepoRoot ?? process.cwd());
  const worktreesRoot = options.worktreesRoot;
  const lock = new PoolStateLock(mainRepoRoot, worktreesRoot);
  if (!(await lock.acquire())) {
    return { released: false };
  }

  try {
    const state = pruneDeadLeases(readPoolState(mainRepoRoot, worktreesRoot));
    let targetSlot = options.slot;

    if (!targetSlot && options.agentId) {
      targetSlot = WORKSPACE_SLOTS.find(
        (slot) => state.slots[slot]?.agentId === options.agentId,
      );
    }

    if (!targetSlot) {
      writePoolState(mainRepoRoot, state, worktreesRoot);
      return { released: false };
    }

    const lease = state.slots[targetSlot];
    if (!lease) {
      writePoolState(mainRepoRoot, state, worktreesRoot);
      return { released: false };
    }

    const owned =
      lease.agentId === options.agentId ||
      lease.pid === process.pid ||
      options.force ||
      !isLeaseActive(lease);

    if (!owned) {
      writePoolState(mainRepoRoot, state, worktreesRoot);
      return { released: false, slot: targetSlot };
    }

    delete state.slots[targetSlot];
    writePoolState(mainRepoRoot, state, worktreesRoot);
    return { released: true, slot: targetSlot };
  } finally {
    lock.release();
  }
}

export async function heartbeatWorkspace(options = {}) {
  const mainRepoRoot = path.resolve(options.mainRepoRoot ?? process.cwd());
  const worktreesRoot = options.worktreesRoot;
  const lock = new PoolStateLock(mainRepoRoot, worktreesRoot);
  if (!(await lock.acquire())) return false;

  try {
    const state = readPoolState(mainRepoRoot, worktreesRoot);
    let targetSlot = options.slot;
    if (!targetSlot && options.agentId) {
      targetSlot = WORKSPACE_SLOTS.find(
        (slot) => state.slots[slot]?.agentId === options.agentId,
      );
    }
    if (!targetSlot) return false;

    const lease = state.slots[targetSlot];
    if (!lease) return false;
    if (
      options.agentId &&
      lease.agentId !== options.agentId &&
      lease.pid !== process.pid
    ) {
      return false;
    }

    lease.lastHeartbeatAt = new Date().toISOString();
    lease.pid = process.pid;
    state.slots[targetSlot] = lease;
    writePoolState(mainRepoRoot, state, worktreesRoot);
    return true;
  } finally {
    lock.release();
  }
}

export function findSlotForRoot(mainRepoRoot, cwd, worktreesRoot) {
  const resolved = path.resolve(cwd);
  return WORKSPACE_SLOTS.find(
    (slot) =>
      path.resolve(getSlotPath(mainRepoRoot, slot, worktreesRoot)) === resolved,
  );
}

export function findLeaseForRoot(mainRepoRoot, cwd, worktreesRoot) {
  const state = readPoolState(mainRepoRoot, worktreesRoot);
  const slot = findSlotForRoot(mainRepoRoot, cwd, worktreesRoot);
  if (!slot) return null;
  const lease = state.slots[slot];
  if (!lease || !isLeaseActive(lease)) return null;
  return { slot, lease };
}

function splitNullTerminated(value) {
  return value ? value.split("\0").filter(Boolean) : [];
}

function copyUntrackedFile(sourceRoot, targetRoot, relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) {
    fs.symlinkSync(fs.readlinkSync(source), target);
    return;
  }
  fs.copyFileSync(source, target);
}

/**
 * Move completed slot work into the primary local checkout without pushing.
 *
 * Safety contract:
 * - primary must be clean, on main, and linearly related to the slot;
 * - conflicts block integration and leave the lease/workspace intact;
 * - the slot is cleaned only after its commits, tracked diff, and untracked
 *   files are all present in the primary checkout.
 */
export function integrateWorkspace(options = {}) {
  const mainRepoRoot = resolveMainRepoRoot(
    options.mainRepoRoot ?? process.cwd(),
  );
  const worktreesRoot = options.worktreesRoot;
  const state = pruneDeadLeases(readPoolState(mainRepoRoot, worktreesRoot));
  let targetSlot = options.slot;

  if (!targetSlot && options.agentId) {
    targetSlot = WORKSPACE_SLOTS.find(
      (slot) => state.slots[slot]?.agentId === options.agentId,
    );
  }
  if (!targetSlot || !WORKSPACE_SLOTS.includes(targetSlot)) {
    return { ok: false, reason: "slot_not_found" };
  }

  const lease = state.slots[targetSlot];
  if (
    lease &&
    isLeaseActive(lease) &&
    options.agentId &&
    lease.agentId !== options.agentId
  ) {
    return { ok: false, reason: "slot_owned_by_another_agent", slot: targetSlot };
  }

  const slotRoot = getSlotPath(mainRepoRoot, targetSlot, worktreesRoot);
  const slotState = inspectSlotWorktree(slotRoot);
  if (!slotState.exists || slotState.unreadable) {
    return { ok: false, reason: "slot_unreadable", slot: targetSlot };
  }

  const primaryState = inspectSlotWorktree(mainRepoRoot);
  if (!primaryState.exists || primaryState.unreadable) {
    return { ok: false, reason: "primary_unreadable", slot: targetSlot };
  }
  if (!primaryState.clean) {
    return {
      ok: false,
      reason: "primary_dirty",
      slot: targetSlot,
      dirtyCount: primaryState.dirtyCount,
      dirtySample: primaryState.dirtySample,
    };
  }
  if (primaryState.branch !== "main") {
    return {
      ok: false,
      reason: "primary_not_main",
      slot: targetSlot,
      branch: primaryState.branch,
    };
  }

  const primaryHead = runGit(mainRepoRoot, ["rev-parse", "HEAD"]);
  const slotHead = runGit(slotRoot, ["rev-parse", "HEAD"]);
  if (!primaryHead.ok || !slotHead.ok) {
    return { ok: false, reason: "head_unreadable", slot: targetSlot };
  }

  const primaryBeforeSlot = runGit(mainRepoRoot, [
    "merge-base",
    "--is-ancestor",
    primaryHead.stdout,
    slotHead.stdout,
  ]).ok;
  const slotBeforePrimary = runGit(mainRepoRoot, [
    "merge-base",
    "--is-ancestor",
    slotHead.stdout,
    primaryHead.stdout,
  ]).ok;
  if (!primaryBeforeSlot && !slotBeforePrimary) {
    return {
      ok: false,
      reason: "histories_diverged",
      slot: targetSlot,
      primaryHead: primaryHead.stdout,
      slotHead: slotHead.stdout,
    };
  }

  const patch = runGit(slotRoot, ["diff", "--binary", "HEAD", "--"], {
    trim: false,
  });
  const untrackedResult = runGit(slotRoot, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  if (!patch.ok || !untrackedResult.ok) {
    return { ok: false, reason: "slot_diff_failed", slot: targetSlot };
  }
  const untracked = splitNullTerminated(untrackedResult.stdout);
  const occupied = untracked.filter((relativePath) =>
    fs.existsSync(path.join(mainRepoRoot, relativePath)),
  );
  if (occupied.length > 0) {
    return {
      ok: false,
      reason: "untracked_collision",
      slot: targetSlot,
      paths: occupied,
    };
  }

  let fastForwarded = false;
  if (primaryHead.stdout !== slotHead.stdout && primaryBeforeSlot) {
    const merge = runGit(mainRepoRoot, [
      "merge",
      "--ff-only",
      slotHead.stdout,
    ]);
    if (!merge.ok) {
      return {
        ok: false,
        reason: "primary_fast_forward_failed",
        slot: targetSlot,
        detail: merge.stderr,
      };
    }
    fastForwarded = true;
  }

  if (patch.stdout) {
    const check = runGit(
      mainRepoRoot,
      ["apply", "--check", "--whitespace=nowarn", "-"],
      { input: patch.stdout },
    );
    if (!check.ok) {
      return {
        ok: false,
        reason: "patch_conflict",
        slot: targetSlot,
        detail: check.stderr,
        fastForwarded,
      };
    }
    const apply = runGit(
      mainRepoRoot,
      ["apply", "--whitespace=nowarn", "-"],
      { input: patch.stdout },
    );
    if (!apply.ok) {
      return {
        ok: false,
        reason: "patch_apply_failed",
        slot: targetSlot,
        detail: apply.stderr,
        fastForwarded,
      };
    }
  }

  for (const relativePath of untracked) {
    copyUntrackedFile(slotRoot, mainRepoRoot, relativePath);
  }

  if (options.cleanSlot !== false) {
    const reset = runGit(slotRoot, ["reset", "--hard", "HEAD"]);
    const clean = runGit(slotRoot, ["clean", "-fd"]);
    if (!reset.ok || !clean.ok) {
      return {
        ok: false,
        reason: "slot_cleanup_failed",
        slot: targetSlot,
        integrated: true,
        detail: reset.stderr || clean.stderr,
      };
    }
  }

  return {
    ok: true,
    slot: targetSlot,
    primaryRoot: mainRepoRoot,
    fastForwarded,
    trackedChanges: Boolean(patch.stdout),
    untrackedCount: untracked.length,
    primaryHead: runGit(mainRepoRoot, ["rev-parse", "--short", "HEAD"]).stdout,
  };
}
