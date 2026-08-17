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

export function isLeaseActive(lease, nowMs = Date.now()) {
  return isProcessAlive(lease.pid) && !isLeaseStale(lease, nowMs);
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

function runGit(mainRepoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: mainRepoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    code: result.status,
  };
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

export function getWorkspaceStatus(mainRepoRoot, nowMs = Date.now(), worktreesRoot) {
  const state = readPoolState(mainRepoRoot, worktreesRoot);
  return WORKSPACE_SLOTS.map((slot) => {
    const rootPath = getSlotPath(mainRepoRoot, slot, worktreesRoot);
    const lease = state.slots[slot] ?? null;
    const active = lease ? isLeaseActive(lease, nowMs) : false;
    return {
      slot,
      rootPath,
      available: !active,
      lease: active ? lease : null,
      stale: Boolean(lease && !active),
    };
  });
}

function pickFreeSlot(state, nowMs = Date.now()) {
  for (const slot of WORKSPACE_SLOTS) {
    const lease = state.slots[slot];
    if (!lease || !isLeaseActive(lease, nowMs)) {
      return slot;
    }
  }
  return null;
}

export async function acquireWorkspace(options = {}) {
  const mainRepoRoot = path.resolve(options.mainRepoRoot ?? process.cwd());
  const worktreesRoot = options.worktreesRoot;
  const wait = options.wait ?? false;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const ensure = options.ensure ?? true;
  const agentId = options.agentId ?? randomUUID();
  const started = Date.now();

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
      const slot = pickFreeSlot(pruned);
      if (slot) {
        const rootPath = getSlotPath(mainRepoRoot, slot, worktreesRoot);
        const now = new Date().toISOString();
        pruned.slots[slot] = {
          agentId,
          pid: process.pid,
          tool: resolveAgentTool(options.tool),
          claimedAt: now,
          lastHeartbeatAt: now,
          task: options.task,
          rootPath,
        };
        writePoolState(mainRepoRoot, pruned, worktreesRoot);
        return {
          ok: true,
          slot,
          rootPath,
          agentId,
          waitedMs: Date.now() - started,
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
