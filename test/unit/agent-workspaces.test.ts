import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  HEARTBEAT_STALE_MS,
  acquireWorkspace,
  getWorkspaceStatus,
  heartbeatWorkspace,
  isLeaseActive,
  isLeaseStale,
  readPoolState,
  releaseWorkspace,
  resolveAgentTool,
} from "../../scripts/agent-workspace-lib.mjs";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function makeFakeRepo(): { repo: string; worktreesRoot: string } {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "tempo-agent-pool-"));
  tempRoots.push(repo);
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".git", "HEAD"), "ref: refs/heads/main\n");
  const worktreesRoot = path.join(repo, "_worktrees");
  return { repo, worktreesRoot };
}

function sampleLease(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    agentId: "agent-a",
    pid: process.pid,
    claimedAt: now,
    lastHeartbeatAt: now,
    rootPath: "/tmp/workspace",
    ...overrides,
  };
}

describe("agent workspace pool", () => {
  it("claims the first free slot without waiting", async () => {
    const { repo, worktreesRoot } = makeFakeRepo();
    const first = await acquireWorkspace({
      mainRepoRoot: repo,
      worktreesRoot,
      ensure: false,
      agentId: "agent-1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.slot).toBe("Workspace 1");

    const second = await acquireWorkspace({
      mainRepoRoot: repo,
      worktreesRoot,
      ensure: false,
      agentId: "agent-2",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.slot).toBe("Workspace 2");
  });

  it("returns all_busy when three slots are taken and wait is false", async () => {
    const { repo, worktreesRoot } = makeFakeRepo();
    for (const id of ["a", "b", "c"]) {
      const result = await acquireWorkspace({
        mainRepoRoot: repo,
        worktreesRoot,
        ensure: false,
        agentId: id,
      });
      expect(result.ok).toBe(true);
    }

    const blocked = await acquireWorkspace({
      mainRepoRoot: repo,
      worktreesRoot,
      ensure: false,
      wait: false,
      agentId: "agent-blocked",
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe("all_busy");
  });

  it("waits until a slot is released", async () => {
    const { repo, worktreesRoot } = makeFakeRepo();
    const holders = await Promise.all(
      ["a", "b", "c"].map((agentId) =>
        acquireWorkspace({
          mainRepoRoot: repo,
          worktreesRoot,
          ensure: false,
          agentId,
        }),
      ),
    );
    expect(holders.every((row) => row.ok)).toBe(true);

    const first = holders[0];
    if (!first.ok) return;

    setTimeout(async () => {
      await releaseWorkspace({
        mainRepoRoot: repo,
        worktreesRoot,
        agentId: first.agentId,
      });
    }, 600);

    const waited = await acquireWorkspace({
      mainRepoRoot: repo,
      worktreesRoot,
      ensure: false,
      wait: true,
      maxWaitMs: 5_000,
      agentId: "agent-waiter",
    });

    expect(waited.ok).toBe(true);
    if (!waited.ok) return;
    expect(waited.waitedMs).toBeGreaterThan(0);
    expect(waited.slot).toBe(first.slot);
  });

  it("treats stale heartbeats as free slots", () => {
    const lease = sampleLease({
      lastHeartbeatAt: new Date(
        Date.now() - HEARTBEAT_STALE_MS - 1_000,
      ).toISOString(),
    });
    expect(isLeaseStale(lease)).toBe(true);
    expect(isLeaseActive(lease)).toBe(false);
  });

  it("records heartbeat for the owning agent", async () => {
    const { repo, worktreesRoot } = makeFakeRepo();
    const acquired = await acquireWorkspace({
      mainRepoRoot: repo,
      worktreesRoot,
      ensure: false,
      agentId: "heartbeat-agent",
    });
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const { slot, agentId } = acquired;

    const before = readPoolState(repo, worktreesRoot).slots[slot]
      ?.lastHeartbeatAt;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const ok = await heartbeatWorkspace({
      mainRepoRoot: repo,
      worktreesRoot,
      agentId,
    });
    expect(ok).toBe(true);

    const after = readPoolState(repo, worktreesRoot).slots[slot]
      ?.lastHeartbeatAt;
    expect(after).not.toBe(before);
  });

  it("reports slot availability in status", async () => {
    const { repo, worktreesRoot } = makeFakeRepo();
    await acquireWorkspace({
      mainRepoRoot: repo,
      worktreesRoot,
      ensure: false,
      agentId: "status-agent",
    });
    const rows = getWorkspaceStatus(repo, Date.now(), worktreesRoot);
    expect(rows.filter((row) => row.available)).toHaveLength(2);
    expect(rows.filter((row) => !row.available)).toHaveLength(1);
  });

  it("labels leases with explicit tool", async () => {
    const { repo, worktreesRoot } = makeFakeRepo();
    const acquired = await acquireWorkspace({
      mainRepoRoot: repo,
      worktreesRoot,
      ensure: false,
      agentId: "codex-agent",
      tool: "codex",
    });
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const { slot } = acquired;
    expect(readPoolState(repo, worktreesRoot).slots[slot]?.tool).toBe(
      "codex",
    );
  });

  it("detects claude from env in resolveAgentTool", () => {
    const prev = process.env.CLAUDE_CODE;
    process.env.CLAUDE_CODE = "1";
    expect(resolveAgentTool()).toBe("claude");
    if (prev === undefined) delete process.env.CLAUDE_CODE;
    else process.env.CLAUDE_CODE = prev;
  });
});
